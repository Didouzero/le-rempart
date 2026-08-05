import type { ArticleQualityMetrics } from "@/lib/eval/metrics-types";
import type { DossierCoverage } from "@/lib/research/types";
import type { WritingMetadata } from "@/lib/writing/types";

/** Grille qualitative manuelle (notes humaines /10). */
export const QUALITATIVE_CRITERIA = [
  "richesseDocumentaire",
  "profondeur",
  "contexte",
  "chronologie",
  "pedagogie",
  "exploitationSources",
  "fluidite",
  "varieteRedactionnelle",
  "effetTemplate",
  "valeurInformative",
  "potentielSeo",
  "impressionGenerale",
] as const;

export type QualitativeCriterion = (typeof QUALITATIVE_CRITERIA)[number];

export const CRITERION_LABELS: Record<QualitativeCriterion, string> = {
  richesseDocumentaire: "Richesse documentaire",
  profondeur: "Profondeur",
  contexte: "Contexte",
  chronologie: "Chronologie",
  pedagogie: "Pédagogie",
  exploitationSources: "Exploitation des sources",
  fluidite: "Fluidité",
  varieteRedactionnelle: "Variété rédactionnelle",
  /** 10 = aucun effet template ; 0 = très template. */
  effetTemplate: "Effet template (10 = aucun)",
  valeurInformative: "Valeur informative",
  potentielSeo: "Potentiel SEO",
  impressionGenerale: "Impression générale",
};

export type QualitativeScores = Partial<Record<QualitativeCriterion, number>>;

export type PublishChoice = "legacy" | "new" | "undecided";

export type ManualScorecard = {
  subjectId: string;
  legacy: QualitativeScores;
  neu: QualitativeScores;
  /** Lequel publierais-je réellement ? */
  wouldPublish: PublishChoice;
  notes?: string;
  /** Faiblesse reliée à research | dossier | writing */
  weaknessOwner?: "research" | "dossier" | "writing" | "none" | "mixed";
  weaknessNotes?: string;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clamp10(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

/**
 * Proxy automatique /10 par critère — accélère la comparaison humaine.
 * Ne remplace PAS la notation manuelle.
 */
export function proxyCriterionScores(
  m: ArticleQualityMetrics,
  extras?: {
    coverage?: DossierCoverage | null;
    writingMetadata?: WritingMetadata | null;
  },
): Record<QualitativeCriterion, number> {
  const cov = extras?.coverage;
  const wm = extras?.writingMetadata;

  const richesseDocumentaire = clamp10(
    (Math.min(m.digitAnchors, 12) / 12) * 4 +
      (Math.min(m.quoteCount, 6) / 6) * 3 +
      (Math.min(m.dateLikeCount, 8) / 8) * 3,
  );

  const profondeur = clamp10(
    (Math.min(m.wordCount, 1600) / 1600) * 4 +
      (Math.min(m.h2Count, 7) / 7) * 3 +
      (Math.min(m.densityScore, 3) / 3) * 3,
  );

  const contexte = clamp10(
    (Math.min(m.properNameHints, 25) / 25) * 4 +
      (Math.min(m.dateLikeCount, 8) / 8) * 3 +
      (cov ? (cov.context / 100) * 3 : (Math.min(m.h2Count, 6) / 6) * 3),
  );

  const chronologie = clamp10(
    (Math.min(m.dateLikeCount, 10) / 10) * 7 +
      (cov ? (cov.chronology / 100) * 3 : (m.h2Titles.some((t) =>
        /chrono|d[eé]roul|comment on en/i.test(t),
      )
        ? 3
        : 1)),
  );

  const pedagogie = clamp10(
    (Math.min(m.h2Count, 6) / 6) * 4 +
      (m.uniqueWordRatio / 100) * 3 +
      (wm?.sectionsUsed?.some((s) =>
        /glossary|concept|naive/i.test(s),
      )
        ? 3
        : 1.5),
  );

  const exploitationSources = clamp10(
    (Math.min(m.quoteCount, 5) / 5) * 4 +
      (Math.min(m.digitAnchors, 10) / 10) * 3 +
      (cov ? (cov.primarySources / 100) * 3 : 2),
  );

  // Fluidité : peu de répétitions, paragraphes ni trop courts ni pavés
  const paraSweet = clamp01(1 - Math.abs(m.avgParagraphWords - 70) / 70);
  const fluidite = clamp10(
    (1 - m.repetitionScore / 100) * 6 + paraSweet * 4,
  );

  const varieteRedactionnelle = clamp10(
    (m.uniqueWordRatio / 100) * 6 +
      (Math.min(m.h2Count, 8) / 8) * 2 +
      (m.boldCount > 3 && m.boldCount < 25 ? 2 : 1),
  );

  const effetTemplate = clamp10(10 - m.templateRisk / 10);

  const valeurInformative = clamp10(
    (Math.min(m.densityScore, 4) / 4) * 5 +
      (Math.min(m.digitAnchors + m.quoteCount, 15) / 15) * 5,
  );

  const titleSeo = m.seoTitleLength >= 35 && m.seoTitleLength <= 75 ? 1 : 0.4;
  const excerptSeo =
    m.seoExcerptLength >= 80 && m.seoExcerptLength <= 220 ? 1 : 0.4;
  const potentielSeo = clamp10(
    titleSeo * 4 + excerptSeo * 3 + (Math.min(m.wordCount, 1200) / 1200) * 3,
  );

  const impressionGenerale = clamp10(
    (richesseDocumentaire +
      profondeur +
      valeurInformative +
      fluidite +
      effetTemplate) /
      5,
  );

  return {
    richesseDocumentaire,
    profondeur,
    contexte,
    chronologie,
    pedagogie,
    exploitationSources,
    fluidite,
    varieteRedactionnelle,
    effetTemplate,
    valeurInformative,
    potentielSeo,
    impressionGenerale,
  };
}

export function globalScoreFromCriteria(
  scores: Record<QualitativeCriterion, number>,
): number {
  const vals = QUALITATIVE_CRITERIA.map((c) => scores[c]);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 10); // /100
}

export type ScoreGain = {
  criterion: QualitativeCriterion;
  label: string;
  delta: number; // new - legacy, /10
  direction: "gain" | "loss" | "flat";
};

export type GlobalAbScores = {
  legacyScore: number;
  newScore: number;
  delta: number;
  legacyCriteria: Record<QualitativeCriterion, number>;
  newCriteria: Record<QualitativeCriterion, number>;
  gains: ScoreGain[];
  losses: ScoreGain[];
  headline: string[];
};

export function buildGlobalAbScores(input: {
  legacyMetrics: ArticleQualityMetrics;
  newMetrics: ArticleQualityMetrics;
  newCoverage?: DossierCoverage | null;
  writingMetadata?: WritingMetadata | null;
}): GlobalAbScores {
  const legacyCriteria = proxyCriterionScores(input.legacyMetrics);
  const newCriteria = proxyCriterionScores(input.newMetrics, {
    coverage: input.newCoverage,
    writingMetadata: input.writingMetadata,
  });

  const legacyScore = globalScoreFromCriteria(legacyCriteria);
  const newScore = globalScoreFromCriteria(newCriteria);

  const gains: ScoreGain[] = [];
  const losses: ScoreGain[] = [];

  for (const c of QUALITATIVE_CRITERIA) {
    const delta = Math.round((newCriteria[c] - legacyCriteria[c]) * 10) / 10;
    const row: ScoreGain = {
      criterion: c,
      label: CRITERION_LABELS[c],
      delta,
      direction: delta > 0.4 ? "gain" : delta < -0.4 ? "loss" : "flat",
    };
    if (row.direction === "gain") gains.push(row);
    if (row.direction === "loss") losses.push(row);
  }

  gains.sort((a, b) => b.delta - a.delta);
  losses.sort((a, b) => a.delta - b.delta);

  const headline: string[] = [
    `Legacy Score : ${legacyScore}/100`,
    `New Pipeline : ${newScore}/100`,
  ];
  if (gains.length) {
    headline.push(`Gain : ${gains.slice(0, 4).map((g) => g.label).join(", ")}`);
  }
  if (losses.length) {
    headline.push(
      `Perte : ${losses.slice(0, 3).map((g) => g.label).join(", ")}`,
    );
  }

  return {
    legacyScore,
    newScore,
    delta: newScore - legacyScore,
    legacyCriteria,
    newCriteria,
    gains,
    losses,
    headline,
  };
}

/** Template Markdown pour notation humaine. */
export function renderManualScorecardMarkdown(input: {
  subjectId: string;
  title: string;
  global: GlobalAbScores;
}): string {
  const rows = QUALITATIVE_CRITERIA.map((c) => {
    const label = CRITERION_LABELS[c];
    const lp = input.global.legacyCriteria[c];
    const np = input.global.newCriteria[c];
    return `| ${label} | ${lp} (proxy) / __ | ${np} (proxy) / __ |`;
  }).join("\n");

  return `# Scorecard — ${input.subjectId}

Sujet : ${input.title}

## Indicateur global (proxy automatique — non décisoire)

- Legacy : **${input.global.legacyScore}/100**
- Nouveau : **${input.global.newScore}/100**
- Delta : **${input.global.delta >= 0 ? "+" : ""}${input.global.delta}**

${input.global.headline.map((h) => `- ${h}`).join("\n")}

## Grille qualitative (compléter les notes humaines /10)

| Critère | Legacy | Nouveau |
|---------|--------|---------|
${rows}

## Décision éditoriale

**Lequel publierais-je réellement ?**

- [ ] Legacy
- [ ] Nouveau
- [ ] Indécis

## Régression / faiblesse

Si le nouveau est moins bon ou seulement équivalent, owner probable :

- [ ] Research Agent
- [ ] ResearchDossier
- [ ] Writing Agent
- [ ] Mixte
- [ ] Aucune (équivalent acceptable)

Notes :
> …

`;
}

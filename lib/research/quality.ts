import { computeDossierCoverage } from "@/lib/research/coverage";
import { estimateSourceTier } from "@/lib/research/source-hierarchy";
import type {
  DossierCoverage,
  DossierQualityScores,
  ResearchDossier,
} from "@/lib/research/types";

/**
 * Seuils sous lesquels une dimension est considérée insuffisante
 * et peut déclencher une passe de complément research.
 */
export const DOSSIER_QUALITY_THRESHOLDS: Omit<DossierQualityScores, "overall"> = {
  facts: 6,
  sources: 6,
  chronology: 5,
  history: 4,
  context: 5,
  legal: 3,
  statistics: 2,
  reactions: 4,
  actors: 5,
  concepts: 3,
};

export type QualityDimension = keyof Omit<DossierQualityScores, "overall">;

const DIMENSION_LABELS: Record<QualityDimension, string> = {
  facts: "faits",
  sources: "sources primaires",
  chronology: "chronologie",
  history: "historique",
  context: "contexte",
  legal: "contexte juridique",
  statistics: "statistiques",
  reactions: "réactions",
  actors: "acteurs",
  concepts: "concepts / glossaire",
};

/** Requêtes types par dimension faible — ciblage de la passe suivante. */
const DIMENSION_QUERY_HINTS: Record<QualityDimension, string[]> = {
  facts: [
    "faits confirmés chronologie officielle",
    "communiqué officiel décision",
  ],
  sources: [
    "site officiel document primaire PDF",
    "legifrance OR vie-publique OR .gouv.fr",
  ],
  chronology: ["chronologie dates affaire", "historique des décisions"],
  history: ["précédents affaire similaire", "historique politique judiciaire"],
  context: ["enjeux contexte politique institutions"],
  legal: ["cadre juridique loi article procédure", "jurisprudence"],
  statistics: ["chiffres statistiques rapport officiel"],
  reactions: ["réactions gouvernement opposition syndicats"],
  actors: ["acteurs institutions organismes rôle"],
  concepts: ["définition procédure institution"],
};

export type DossierQualityReport = {
  scores: DossierQualityScores;
  coverage: DossierCoverage;
  weakDimensions: QualityDimension[];
  /** Alias pratique (= readyForWriting). */
  ready: boolean;
  readyForWriting: boolean;
  /** Labels FR des manques exploitables par le Research Agent. */
  missing: string[];
  /** Requêtes concrètes pour la passe d'enrichissement suivante. */
  nextQueries: string[];
  notes: string[];
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function scoreFilledText(value: string, fullAt = 80): number {
  const len = value.trim().length;
  if (len === 0) return 0;
  if (len >= fullAt) return 10;
  return clampScore((len / fullAt) * 10);
}

function scoreList(items: unknown[], fullAt: number): number {
  if (!items.length) return 0;
  if (items.length >= fullAt) return 10;
  return clampScore((items.length / fullAt) * 10);
}

function buildNextQueries(
  subject: string,
  weak: QualityDimension[],
  dossier: ResearchDossier,
): string[] {
  const queries: string[] = [];
  const core = subject.replace(/\s+/g, " ").trim().slice(0, 80);

  for (const dim of weak.slice(0, 5)) {
    for (const hint of DIMENSION_QUERY_HINTS[dim].slice(0, 1)) {
      queries.push(`${core} ${hint}`.trim());
    }
  }

  for (const miss of dossier.missingInformation.slice(0, 3)) {
    const q = `${core} ${miss}`.replace(/\s+/g, " ").trim().slice(0, 140);
    if (q.length >= 12) queries.push(q);
  }

  for (const nq of dossier.naiveQuestions.filter((q) => q.unanswered).slice(0, 2)) {
    queries.push(`${core} ${nq.question}`.slice(0, 140));
  }

  return [...new Set(queries)].slice(0, 6);
}

/**
 * Évaluation heuristique + diagnostic exploitable.
 * Sortie type : { ready, missing, nextQueries, scores… }
 */
export function evaluateDossierQuality(
  dossier: ResearchDossier,
): DossierQualityReport {
  const notes: string[] = [];

  const summaryParts = [
    dossier.summary.who,
    dossier.summary.what,
    dossier.summary.when,
    dossier.summary.where,
    dossier.summary.why,
    dossier.summary.how,
  ];
  const filledSummary = summaryParts.filter((p) => p.trim().length > 0).length;
  const confirmedFacts = (dossier.keyFacts || []).filter(
    (f) => f.confidence === "confirmed",
  ).length;

  const facts = clampScore(
    (filledSummary / 6) * 5 +
      scoreList(dossier.keyFacts || [], 5) * 0.3 +
      Math.min(confirmedFacts, 3) +
      scoreFilledText(dossier.importance.whyItMatters, 120) * 0.1,
  );

  // Source-first : tiers 1–4 pèsent beaucoup plus que la presse / le social.
  const tierBonus = (dossier.sources || []).reduce((acc, s) => {
    const tier = s.tier ?? estimateSourceTier(s);
    if (tier <= 2) return acc + 2.2;
    if (tier <= 4) return acc + 1.8;
    if (tier <= 7) return acc + 1.0;
    if (tier === 8) return acc + 0.5;
    return acc + 0.1;
  }, 0);
  const scrapedCount = (dossier.sources || []).filter((s) => s.scraped).length;
  const tracedFacts = (dossier.keyFacts || []).filter(
    (f) => (f.sourceUrls?.length || 0) > 0,
  ).length;

  const sources = clampScore(
    Math.min(tierBonus, 7) +
      Math.min(scrapedCount, 4) * 0.4 +
      Math.min(tracedFacts, 4) * 0.3,
  );

  const chronology = scoreList(dossier.chronology, 5);
  const history = clampScore(
    scoreList(dossier.history.precedents, 2) * 0.35 +
      scoreList(dossier.history.similarCases, 2) * 0.25 +
      scoreList(dossier.history.politicalHistory, 2) * 0.2 +
      scoreList(dossier.history.judicialHistory, 2) * 0.2,
  );

  const context = clampScore(
    scoreList(dossier.politicalContext.institutions, 2) * 0.4 +
      scoreList(dossier.politicalContext.consequences, 2) * 0.3 +
      scoreFilledText(dossier.importance.whyItMatters, 100) * 0.3,
  );

  const legal = clampScore(
    scoreList(dossier.legalContext.laws, 2) * 0.4 +
      scoreList(dossier.legalContext.procedures, 2) * 0.3 +
      scoreList(dossier.legalContext.caseLaw, 2) * 0.3,
  );

  const statistics = clampScore(
    scoreList(dossier.data.statistics, 3) * 0.5 +
      scoreList(dossier.data.reports, 2) * 0.25 +
      scoreList(dossier.data.budgets, 2) * 0.25,
  );

  const reactionCount =
    dossier.reactions.government.length +
    dossier.reactions.opposition.length +
    dossier.reactions.experts.length +
    dossier.reactions.associations.length +
    dossier.reactions.academics.length +
    dossier.reactions.unions.length +
    dossier.reactions.ngos.length;
  const reactions = scoreList(Array.from({ length: reactionCount }), 4);

  const actors = scoreList(dossier.actors, 3);
  const concepts = clampScore(
    scoreList(dossier.conceptsToExplain, 2) * 0.5 +
      scoreList(dossier.glossary, 2) * 0.5,
  );

  const scores: DossierQualityScores = {
    facts,
    sources,
    chronology,
    history,
    context,
    legal,
    statistics,
    reactions,
    actors,
    concepts,
    overall: 0,
  };

  const dims: QualityDimension[] = [
    "facts",
    "sources",
    "chronology",
    "history",
    "context",
    "legal",
    "statistics",
    "reactions",
    "actors",
    "concepts",
  ];
  scores.overall = clampScore(
    dims.reduce((acc, d) => acc + scores[d], 0) / dims.length,
  );

  const weakDimensions = dims.filter(
    (d) => scores[d] < DOSSIER_QUALITY_THRESHOLDS[d],
  );
  const missing = weakDimensions.map((d) => DIMENSION_LABELS[d]);

  if (dossier.missingInformation.length > 0) {
    notes.push(
      `${dossier.missingInformation.length} information(s) manquante(s) signalée(s).`,
    );
  }
  if (dossier.uncertainties.length > 0) {
    notes.push(
      `${dossier.uncertainties.length} zone(s) d'incertitude à respecter à la rédaction.`,
    );
  }
  if (missing.length > 0) {
    notes.push(`Manques : ${missing.join(", ")}.`);
  }

  const readyForWriting =
    scores.facts >= DOSSIER_QUALITY_THRESHOLDS.facts &&
    scores.sources >= DOSSIER_QUALITY_THRESHOLDS.sources;

  if (!readyForWriting) {
    notes.push(
      "Dossier non prêt pour la rédaction (faits ou sources insuffisants).",
    );
  }

  const nextQueries = buildNextQueries(dossier.subject, weakDimensions, dossier);
  const coverage = computeDossierCoverage(dossier);

  if (coverage.primarySources < 50) {
    notes.push(
      "Couverture sources primaires faible — privilégier documents officiels / communiqués.",
    );
  }

  return {
    scores,
    coverage,
    weakDimensions,
    ready: readyForWriting,
    readyForWriting,
    missing,
    nextQueries,
    notes,
  };
}

export function shouldEnrichDossier(report: DossierQualityReport): boolean {
  if (!report.ready) return true;
  const enrichable: QualityDimension[] = [
    "facts",
    "sources",
    "chronology",
    "history",
    "context",
    "actors",
    "reactions",
  ];
  return report.weakDimensions.some((d) => enrichable.includes(d));
}

/** Forme compacte demandée pour le diagnostic exploitable. */
export function toQualityDiagnostic(report: DossierQualityReport): {
  ready: boolean;
  missing: string[];
  nextQueries: string[];
} {
  return {
    ready: report.ready,
    missing: report.missing,
    nextQueries: report.nextQueries,
  };
}

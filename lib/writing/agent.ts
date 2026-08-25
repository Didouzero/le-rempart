import { getKimiTextModel } from "@/lib/kimi-legacy";
import { moonshotChat } from "@/lib/moonshot";
import type { ResearchDossier } from "@/lib/research/types";
import {
  ARTICLE_LENGTH,
  CONFIDENCE_VOCAB,
  WRITING_HARD_RULES,
} from "@/lib/writing/constraints";
import { parseWritingResponse } from "@/lib/writing/parse";
import { pickStructureVariant } from "@/lib/writing/structure";
import type { WritingAgentResult } from "@/lib/writing/types";

export type WritingAgentInput = {
  dossier: ResearchDossier;
  subjectTitle: string;
  /** Moins de retries / timeouts plus courts (Telegram / Vercel). */
  fast?: boolean;
};

export type { WritingAgentResult };
export { ARTICLE_LENGTH, WRITING_HARD_RULES };

const SYSTEM_PROMPT = `Tu es rédacteur en chef du Rempart, média français ancré à droite.

Tu n'es PAS un générateur de texte, et tu n'es pas un éditorialiste. Tu es un journaliste qui
transforme un dossier documentaire en article d'information dense, nommé, daté, chiffré.
L'angle politique arrive à la fin, une fois que le lecteur sait tout.

RÈGLES ABSOLUES :
${WRITING_HARD_RULES.map((r) => `- ${r}`).join("\n")}

VOCABULAIRE DE CONFIANCE (obligatoire) :
- confirmed → ${CONFIDENCE_VOCAB.confirmed.join(" / ")}
- probable → ${CONFIDENCE_VOCAB.probable.join(" / ")}
- contested → ${CONFIDENCE_VOCAB.contested.join(" / ")}
- unverifiable → ${CONFIDENCE_VOCAB.unverifiable.join(" / ")}
Jamais une info incertaine présentée comme certaine.

TITRE :
- Précis et factuel : QUI + QUOI + OÙ, avec le chiffre clé s'il existe.
- Le nom exact de l'organisation ou de la personne au cœur de l'affaire doit y figurer.
- Pas de slogan, pas de question rhétorique, pas de point d'exclamation.

CHAPÔ (excerpt) :
- 2 phrases factuelles maximum : qui, quoi, où, quand, montant.
- Zéro sarcasme, zéro adjectif d'indignation.

CORPS DE L'ARTICLE :
- Les ## H2 sont dictés par la matière du dossier, pas par un gabarit. Selon ce qui existe :
  les faits et le montant en jeu, la structure concernée et son périmètre, les dirigeants et leurs
  rémunérations, la chronologie de la procédure, les conséquences concrètes (salariés, usagers,
  collectivités, contribuable), le débat politique et les réactions, ce qui reste inconnu.
- Un H2 = un angle réellement documenté. Pas de section creuse pour faire nombre.
- Nomme : personnes (nom complet + fonction + étiquette politique si le dossier la donne),
  organisations avec leur périmètre exact, communes, juridictions, dates, montants au chiffre près.
- Attribue explicitement : "selon l'enquête de <média du dossier>", "d'après <média>". N'utilise QUE
  les médias listés dans sources / mediaHistory du dossier.
- Reprends les verbatims du dossier entre guillemets, avec leur auteur.
- Explique les mécanismes concrets : comment le déficit s'est creusé, comment la procédure fonctionne,
  qui décide quoi. Le lecteur doit comprendre l'enchaînement, pas seulement le résultat.
- Explique les notions de conceptsToExplain / glossary quand elles servent la compréhension.
- Réponds aux naiveQuestions et articleQuestions du dossier quand la réponse existe.
- Une section "ce que l'on ne sait pas encore" est bienvenue si missingInformation / uncertainties
  contiennent de la matière.

LISTES :
- Les listes à puces sont AUTORISÉES et recommandées quand elles clarifient : jalons de chronologie,
  décomposition d'un montant, liste de conséquences, points encore inconnus.
- Maximum 2 blocs de listes, 3 à 6 puces chacun, chaque puce factuelle et sourcée par le dossier.
- Le reste doit rester rédigé : une liste ne remplace pas l'analyse.

ANGLE REMPART :
- UNIQUEMENT dans la dernière section (ex. "Le regard du Rempart", "Ce que révèle ce dossier").
- Critique de la gestion, de l'entre-soi politique, du coût pour le contribuable : appuyée sur les
  faits déjà exposés, sans nouveau fait, sans insulte, sans procès d'intention non documenté.
- Aucune trace de ce ton dans les sections factuelles ni dans le chapô.

DOSSIER FAIBLE OU VIDE :
- Si keyFacts est vide ou ne contient rien de vérifiable sur le sujet : écris une brève courte
  (${ARTICLE_LENGTH.cautiousMinWords}–350 mots), 2 H2 suffisent, qui dit franchement ce qui circule,
  ce qui n'est pas vérifié, et ce qu'il faudrait pour l'établir.
- Dans ce cas : AUCUN nom de personne, AUCUN montant, AUCUN média cité qui ne soit pas dans le dossier.
  Mieux vaut trois paragraphes honnêtes qu'un article inventé.

LONGUEUR ET FORME :
- Dossier riche : ${ARTICLE_LENGTH.targetMinWords}–${ARTICLE_LENGTH.targetMaxWords} mots.
- Chaque paragraphe apporte une information nouvelle. Supprime toute reformulation.
- Gras (**…**) sur 8–20 expressions clés (noms, montants, dates) — jamais une phrase entière.
- INTERDIT tiret long (—) / demi-cadratin (–).
- INTERDIT les formules de remplissage ("Il convient de noter", "En conclusion", "force est de
  constater", enfilades d'adjectifs).

Réponds UNIQUEMENT en JSON valide :
{
  "title": "...",
  "excerpt": "...",
  "content": "Markdown avec ## ...",
  "metadata": {
    "plan": ["Les faits", "La chronologie", "..."],
    "sectionsUsed": ["keyFacts", "chronology", "..."],
    "sectionsIgnored": ["socialMedia", "..."],
    "unusedDossierElements": ["citation X non reprise", "..."],
    "warnings": ["coverage juridique faible", "..."]
  }
}`;

function dossierPayload(dossier: ResearchDossier): string {
  const slim = {
    schemaVersion: dossier.schemaVersion,
    subject: dossier.subject,
    summary: dossier.summary,
    keyFacts: dossier.keyFacts,
    actors: dossier.actors,
    chronology: dossier.chronology,
    citations: dossier.citations.slice(0, 20),
    importance: dossier.importance,
    history: dossier.history,
    data: dossier.data,
    politicalContext: dossier.politicalContext,
    legalContext: dossier.legalContext,
    reactions: dossier.reactions,
    verification: dossier.verification,
    uncertainties: dossier.uncertainties,
    missingInformation: dossier.missingInformation,
    conceptsToExplain: dossier.conceptsToExplain,
    glossary: dossier.glossary,
    naiveQuestions: dossier.naiveQuestions,
    articleQuestions: dossier.articleQuestions,
    graph: dossier.graph,
    coverage: dossier.coverage,
    secondaryAngleDivergences: dossier.secondaryAngleDivergences,
    sources: dossier.sources.map((s) => ({
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      type: s.type,
      tier: s.tier,
      confidence: s.confidence,
    })),
    lastDiagnostic: dossier.lastDiagnostic,
  };
  return JSON.stringify(slim);
}

type DossierStrength = "rich" | "thin" | "empty";

/** Force réelle du dossier : décide longueur, ton et niveau de prudence. */
function dossierStrength(dossier: ResearchDossier): DossierStrength {
  const facts = dossier.keyFacts?.length ?? 0;
  const traced = (dossier.keyFacts || []).filter(
    (f) => (f.sourceUrls?.length || 0) > 0,
  ).length;
  const overall = dossier.coverage?.overall ?? 0;

  if (facts === 0) return "empty";
  if (facts <= 2 && traced === 0) return "empty";
  if (facts >= 6 || overall >= 45) return "rich";
  return "thin";
}

function minWordsForDossier(strength: DossierStrength): number {
  if (strength === "empty") return ARTICLE_LENGTH.cautiousMinWords;
  if (strength === "thin") return ARTICLE_LENGTH.minWordsThin;
  return ARTICLE_LENGTH.minWordsRich;
}

/**
 * Inventaire explicite de ce que le dossier NOMME.
 * Sans ça le modèle produit des généralités là où il a des noms et des chiffres.
 */
function namedMaterialBlock(dossier: ResearchDossier): string | null {
  const people = dossier.actors
    .filter((a) => a.name)
    .slice(0, 10)
    .map((a) =>
      [a.name, a.role, a.partyOrAffiliation].filter(Boolean).join(" — "),
    );

  const amounts = [
    ...dossier.data.budgets,
    ...dossier.data.statistics,
  ].slice(0, 10);

  const dates = dossier.chronology
    .filter((e) => e.date)
    .slice(0, 12)
    .map((e) => `${e.date} : ${e.description}`.slice(0, 180));

  const outlets = [
    ...new Set(
      dossier.sources
        .map((s) => s.publisher || "")
        .filter((p) => p && !/^seed:/.test(p)),
    ),
  ].slice(0, 8);

  const blocks: string[] = [];
  if (people.length)
    blocks.push(`Personnes / organisations à nommer :\n- ${people.join("\n- ")}`);
  if (amounts.length)
    blocks.push(`Chiffres à reprendre au chiffre près :\n- ${amounts.join("\n- ")}`);
  if (dates.length) blocks.push(`Jalons datés :\n- ${dates.join("\n- ")}`);
  if (outlets.length)
    blocks.push(
      `Seuls médias citables (aucun autre) :\n- ${outlets.join("\n- ")}`,
    );
  if (dossier.history.mediaHistory.length)
    blocks.push(
      `Qui a révélé quoi :\n- ${dossier.history.mediaHistory.slice(0, 6).join("\n- ")}`,
    );

  if (blocks.length === 0) return null;
  return [
    "MATIÈRE NOMMÉE DU DOSSIER (à exploiter, pas à paraphraser vaguement) :",
    ...blocks,
  ].join("\n\n");
}

/**
 * Writing Agent — rédacteur en chef.
 * Consomme uniquement le ResearchDossier. Aucune recherche.
 */
export async function runWritingAgent(
  input: WritingAgentInput,
): Promise<WritingAgentResult> {
  if (!process.env.MOONSHOT_API_KEY) {
    throw new Error("Writing Agent : MOONSHOT_API_KEY manquant");
  }

  const variant = pickStructureVariant(input.subjectTitle || input.dossier.subject);
  const strength = dossierStrength(input.dossier);
  const minWords = minWordsForDossier(strength);
  const coverage = input.dossier.coverage;
  const cautious = strength === "empty";

  const userContent = [
    `Sujet : ${input.subjectTitle || input.dossier.subject}`,
    cautious
      ? [
          "DOSSIER INSUFFISANT : la recherche n'a pas établi les faits de ce sujet.",
          `Écris une BRÈVE PRUDENTE de ${ARTICLE_LENGTH.cautiousMinWords} à 350 mots, 2 H2 suffisent :`,
          "1) ce qui circule et sous quelle forme, présenté comme non vérifié ;",
          "2) ce qui manque pour l'établir (documents, décision de justice, chiffres officiels).",
          "INTERDIT ABSOLU : citer un nom de personne, un montant, une date précise ou un média",
          "qui ne figure pas dans le dossier. Pas d'éditorial, pas de montée en généralité militante.",
        ].join("\n")
      : [
          `Variante de structure indicative (les H2 doivent d'abord suivre la matière du dossier) : ${variant.id} — ${variant.label}`,
          `Plan suggéré : ${variant.suggestedPlan.join(" → ")}`,
          `Ouverture : ${variant.openingHint}`,
          `Clôture : ${variant.closingHint}`,
        ].join("\n"),
    cautious ? null : namedMaterialBlock(input.dossier),
    coverage
      ? `Coverage dossier (%): faits ${coverage.facts}, chrono ${coverage.chronology}, primaires ${coverage.primarySources}, contexte ${coverage.context}, réactions ${coverage.reactions}, historique ${coverage.history}, juridique ${coverage.legal}, stats ${coverage.statistics}, overall ${coverage.overall}`
      : null,
    cautious
      ? `Cible longueur : ${ARTICLE_LENGTH.cautiousMinWords}–350 mots.`
      : `Cible longueur : ${ARTICLE_LENGTH.targetMinWords}–${ARTICLE_LENGTH.targetMaxWords} mots (min acceptable ${minWords}).`,
    "RESEARCH DOSSIER (seule source autorisée) :",
    dossierPayload(input.dossier),
    cautious
      ? "Rédige la brève JSON prudente. Métadonnées Editor obligatoires."
      : "Rédige l'article JSON : faits nommés et chiffrés d'abord, mécanismes ensuite, angle Rempart dans la dernière section seulement. Métadonnées Editor obligatoires.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const attempts: Array<{ timeoutMs: number; maxTokens: number; model?: string }> =
    input.fast
      ? [
          { timeoutMs: 70_000, maxTokens: 5500, model: "kimi-k2.6" },
          { timeoutMs: 65_000, maxTokens: 5000 },
        ]
      : [
          { timeoutMs: 90_000, maxTokens: 6500 },
          { timeoutMs: 95_000, maxTokens: 7000 },
          { timeoutMs: 80_000, maxTokens: 5500, model: "kimi-k2.6" },
        ];

  let lastErr: unknown;
  let lengthHint = "";

  for (const attempt of attempts) {
    try {
      const raw = await moonshotChat({
        model: attempt.model || getKimiTextModel(),
        maxTokens: attempt.maxTokens,
        timeoutMs: attempt.timeoutMs,
        reasoningEffort: attempt.model ? undefined : "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              userContent,
              lengthHint || null,
              cautious
                ? `OBLIGATOIRE : au moins ${minWords} mots, et rien d'inventé. La prudence prime sur la longueur.`
                : `OBLIGATOIRE : vise au moins ${minWords} mots en exploitant chronologie, acteurs, montants, citations et contexte du dossier (sans jamais inventer).`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      });
      return parseWritingResponse(raw, {
        subjectTitle: input.subjectTitle,
        structureVariantId: variant.id,
        minWords,
        cautious,
      });
    } catch (err) {
      lastErr = err;
      console.error("Writing Agent attempt failed", err);
      const msg = err instanceof Error ? err.message : String(err);
      const short = msg.match(/trop court \((\d+) mots/);
      if (short) {
        lengthHint = `RETRY LONGUEUR : ta version précédente faisait seulement ${short[1]} mots. Allonge en développant les sections du dossier encore sous-exploitées (chronologie, réactions, précédents, juridique, glossaire). Interdit d'inventer des faits.`;
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("Writing Agent : échec après retries");
}

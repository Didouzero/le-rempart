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

const SYSTEM_PROMPT = `Tu es rédacteur en chef du Rempart, média français clairement ancré à droite.

Tu n'es PAS un générateur de texte. Tu es un rédacteur qui transforme un dossier documentaire en article journalistique.

RÈGLES ABSOLUES :
${WRITING_HARD_RULES.map((r) => `- ${r}`).join("\n")}

VOCABULAIRE DE CONFIANCE (obligatoire) :
- confirmed → ${CONFIDENCE_VOCAB.confirmed.join(" / ")}
- probable → ${CONFIDENCE_VOCAB.probable.join(" / ")}
- contested → ${CONFIDENCE_VOCAB.contested.join(" / ")}
- unverifiable → ${CONFIDENCE_VOCAB.unverifiable.join(" / ")}
Jamais une info incertaine présentée comme certaine.

STRUCTURE JOURNALISTIQUE :
1. Faits
2. Contexte
3. Explications / pédagogie (concepts, glossaire si utile)
4. Réactions
5. Précédents
6. Conséquences
7. Analyse éditoriale Rempart (SEULEMENT à la fin)

Le lecteur doit comprendre le sujet AVANT toute analyse.
Le ton Rempart (sarcasme, critique de l'incurie, défense du contribuable) = couche de présentation :
transitions, formulations, mises en perspective, conclusion — JAMAIS dans l'exposé des faits.

DENSITÉ :
- Chaque paragraphe = une information nouvelle.
- Supprime toute reformulation creuse.
- Moins de texte vaut mieux que du remplissage.
- Explique les notions du glossaire / conceptsToExplain quand elles aident le lecteur.
- Réponds aux naiveQuestions et articleQuestions du dossier quand les réponses existent.
- Exploite acteurs, chronologie, juridique, graphe, précédents, coverage.

VARIÉTÉ :
- Varie rythme, transitions, longueur des paragraphes, libellés des H2, ouverture et conclusion.
- Ne reproduis pas un moule. Les titres de section peuvent varier.
- 3 à 8 sous-titres ## selon la richesse du dossier.

LONGUEUR :
- Vise ${ARTICLE_LENGTH.targetMinWords}–${ARTICLE_LENGTH.targetMaxWords} mots si le dossier le justifie.
- Minimum ~${ARTICLE_LENGTH.minWordsRich} si le dossier est riche ; sinon plus court plutôt que du filler.
- Markdown : gras (**…**) sur 8–20 expressions impactantes (jamais une phrase entière).
- INTERDIT tiret long (—) / demi-cadratin (–).
- INTERDIT style ChatGPT ("Il convient de noter", "En conclusion", listes d'adjectifs).
- excerpt = chapô FACTUEL (1–2 phrases : qui / quoi / où / quand). Pas de sarcasme dans le chapô.

Réponds UNIQUEMENT en JSON valide :
{
  "title": "...",
  "excerpt": "...",
  "content": "Markdown avec ## ...",
  "metadata": {
    "plan": ["Chapô", "Les faits", "..."],
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

function minWordsForDossier(dossier: ResearchDossier): number {
  const overall = dossier.coverage?.overall ?? 0;
  const facts = dossier.keyFacts?.length ?? 0;
  if (overall >= 55 || facts >= 5) return ARTICLE_LENGTH.minWordsRich;
  return ARTICLE_LENGTH.minWordsThin;
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
  const minWords = minWordsForDossier(input.dossier);
  const coverage = input.dossier.coverage;

  const userContent = [
    `Sujet : ${input.subjectTitle || input.dossier.subject}`,
    `Variante de structure à suivre (adapte les titres, ne copie pas mécaniquement) : ${variant.id} — ${variant.label}`,
    `Plan suggéré : ${variant.suggestedPlan.join(" → ")}`,
    `Ouverture : ${variant.openingHint}`,
    `Clôture : ${variant.closingHint}`,
    coverage
      ? `Coverage dossier (%): faits ${coverage.facts}, chrono ${coverage.chronology}, primaires ${coverage.primarySources}, contexte ${coverage.context}, réactions ${coverage.reactions}, historique ${coverage.history}, juridique ${coverage.legal}, stats ${coverage.statistics}, overall ${coverage.overall}`
      : null,
    `Cible longueur : ${ARTICLE_LENGTH.targetMinWords}–${ARTICLE_LENGTH.targetMaxWords} mots (min acceptable ${minWords}).`,
    "RESEARCH DOSSIER (seule source autorisée) :",
    dossierPayload(input.dossier),
    "Rédige l'article JSON. Faits d'abord, analyse Rempart en dernier. Métadonnées Editor obligatoires.",
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
              `OBLIGATOIRE : vise au moins ${minWords} mots en exploitant chronologie, acteurs, citations, questions naïves et contexte du dossier (sans inventer).`,
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

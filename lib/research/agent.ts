import { collectDeepSources } from "@/lib/research/collect";
import {
  buildDossierFromDocuments,
  mergeDossiers,
} from "@/lib/research/build-dossier";
import { computeDossierCoverage } from "@/lib/research/coverage";
import {
  evaluateDossierQuality,
  shouldEnrichDossier,
  toQualityDiagnostic,
  type DossierQualityReport,
} from "@/lib/research/quality";
import { isReliableSource } from "@/lib/research/source-hierarchy";
import type { PipelineSubject } from "@/lib/pipeline/types";
import type { ResearchDossier } from "@/lib/research/types";

/**
 * Research Agent — Knowledge Builder (source-first).
 *
 * Boucle :
 * collecte → construction → quality gate → enrichissement ciblé → fusion → gate
 *
 * S'arrête dès qu'il n'existe plus de source fiable à exploiter.
 * Jamais de remplissage artificiel des sections vides.
 */

export type ResearchAgentInput = PipelineSubject & {
  maxPasses?: number;
};

export type ResearchAgentResult = {
  dossier: ResearchDossier;
  quality: DossierQualityReport;
};

const DEFAULT_MAX_PASSES = 2;

function applyQuality(
  dossier: ResearchDossier,
  quality: DossierQualityReport,
): void {
  dossier.quality = quality.scores;
  dossier.qualityNotes = quality.notes;
  dossier.coverage = quality.coverage;
  dossier.lastDiagnostic = toQualityDiagnostic(quality);
  dossier.updatedAt = new Date().toISOString();
}

export async function runResearchAgent(
  input: ResearchAgentInput,
): Promise<ResearchAgentResult> {
  const maxPasses = Math.max(1, Math.min(input.maxPasses ?? DEFAULT_MAX_PASSES, 3));

  // Caption / titre seuls doivent suffire : recherche web → scrape ou snippets.
  const researchTitle = input.title || input.caption || "Actualité";
  const firstCollect = await collectDeepSources({
    title: researchTitle,
    sourceUrl: input.sourceUrl,
    sourceText: input.sourceText,
  });

  let dossier = await buildDossierFromDocuments({
    subject: researchTitle,
    sourceUrl: input.sourceUrl,
    sources: firstCollect.sources,
    secondaryCaption: input.caption,
  });
  dossier.researchPasses = 1;

  let quality = evaluateDossierQuality(dossier);
  applyQuality(dossier, quality);

  for (let pass = 2; pass <= maxPasses; pass += 1) {
    if (!shouldEnrichDossier(quality)) break;
    if (quality.nextQueries.length === 0 && quality.missing.length === 0) break;

    const enrichCollect = await collectDeepSources({
      title: input.title,
      sourceUrl: input.sourceUrl,
      extraQueries: quality.nextQueries,
      alreadyHaveUrls: dossier.sources.map((s) => s.url),
    });

    // Arrêt strict : uniquement des sources fiables (tier ≤ 8, scrapées).
    const reliable = enrichCollect.sources.filter(isReliableSource);
    if (reliable.length === 0) {
      quality.notes.push(
        `Passe ${pass} : plus aucune source fiable exploitable — arrêt (pas de remplissage artificiel).`,
      );
      applyQuality(dossier, quality);
      break;
    }

    const patch = await buildDossierFromDocuments({
      subject: input.title,
      sourceUrl: input.sourceUrl,
      sources: [...dossier.sources, ...reliable],
      focusMissing: quality.missing,
      focusQueries: quality.nextQueries,
      secondaryCaption: input.caption,
    });
    patch.researchPasses = 1;

    dossier = mergeDossiers(dossier, patch);
    dossier.researchPasses = pass;

    quality = evaluateDossierQuality(dossier);
    applyQuality(dossier, quality);
  }

  // Couverture finale même si quality déjà posée
  dossier.coverage = computeDossierCoverage(dossier);

  return { dossier, quality };
}

/** Sérialise le dossier pour le writer (consommateur du savoir). */
export function serializeDossierForWriter(dossier: ResearchDossier): string {
  const slim = {
    schemaVersion: dossier.schemaVersion,
    subject: dossier.subject,
    summary: dossier.summary,
    keyFacts: dossier.keyFacts,
    actors: dossier.actors,
    chronology: dossier.chronology,
    citations: dossier.citations,
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
    sources: dossier.sources.map((s) => ({
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      type: s.type,
      tier: s.tier,
      confidence: s.confidence,
      publicationDate: s.publicationDate,
    })),
    lastDiagnostic: dossier.lastDiagnostic,
    extensions: dossier.extensions,
  };

  return [
    "=== RESEARCH DOSSIER (base de connaissances — faits uniquement) ===",
    "INTERDIT d'inventer hors de ce dossier. Respecte confidence + traçabilité (sourceUrls).",
    "Si une info manque ou est unverifiable : le dire. Ne comble jamais les trous.",
    "Aucun ton éditorial dans ces données : l'angle Rempart est ta responsabilité seule.",
    JSON.stringify(slim),
  ].join("\n");
}

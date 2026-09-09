import {
  createRunId,
  finalizeObservability,
  StageTimer,
} from "@/lib/eval/observability";
import { beginTokenMeter, setTokenMeterStage } from "@/lib/eval/token-meter";
import { generateArticleLegacy } from "@/lib/kimi-legacy";
import type {
  EditorialPipelineResult,
  PipelineStageId,
  PipelineSubject,
} from "@/lib/pipeline/types";
import { runResearchAgent } from "@/lib/research/agent";
import { runWritingAgent } from "@/lib/writing/agent";
import { withTimeout } from "@/lib/with-timeout";

export type RunEditorialPipelineOptions = {
  /** Inclure le dossier complet dans observability (dev / eval). */
  includeDossierInObservability?: boolean;
  /** Passe research (défaut 2). Telegram/publish : 1 pour tenir sous maxDuration Vercel. */
  maxResearchPasses?: number;
  /** Budget research (ms). Au-delà → fallback legacy. */
  researchTimeoutMs?: number;
  /** Budget writing (ms). Au-delà → fallback legacy ancré sur dossier. */
  writingTimeoutMs?: number;
  /** Mode rapide : timeouts Moonshot/search plus courts. */
  fast?: boolean;
  /** URL scrapée = matière principale ; skip web search si corpus riche. */
  sourceFirst?: boolean;
  extraQueries?: string[];
  investigation?: boolean;
  /** Brief éditorial (prompt Telegram / .txt) — angle et question centrale. */
  editorialBrief?: string;
  onProgress?: (message: string) => void | Promise<void>;
};

/**
 * Orchestrateur éditorial (étape D) :
 *   research → quality_gate → writing (rédacteur en chef)
 *
 * Fallback :
 *   1) Writing échoue → legacy ancré sur le dossier sérialisé
 *   2) Research échoue → legacy sujet seul
 */
export async function runEditorialPipeline(
  subject: PipelineSubject,
  opts?: RunEditorialPipelineOptions,
): Promise<EditorialPipelineResult> {
  const stagesRun: PipelineStageId[] = [];
  const runId = createRunId();
  const startedAtMs = Date.now();
  const timer = new StageTimer();
  beginTokenMeter("research");
  const progress = opts?.onProgress || (async () => {});
  const researchTimeoutMs = opts?.researchTimeoutMs ?? 150_000;
  const writingTimeoutMs = opts?.writingTimeoutMs ?? 80_000;

  try {
    timer.start("research");
    setTokenMeterStage("research");
    await progress(
      opts?.sourceFirst
        ? "Lecture de la source + construction du dossier…"
        : "Recherche web + construction du dossier…",
    );
    const { dossier, quality } = await (async () => {
      try {
        return await withTimeout(
          runResearchAgent({
            ...subject,
            maxPasses: opts?.maxResearchPasses,
            extraQueries: opts?.extraQueries,
            fast: opts?.fast,
            sourceFirst: opts?.sourceFirst,
            investigation: opts?.investigation,
          }),
          researchTimeoutMs,
          "Timeout research",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const seedText = opts?.editorialBrief || subject.sourceText;
        if (!opts?.investigation || !seedText || seedText.trim().length < 40) {
          throw err;
        }
        console.error("investigation research failed — brief-only", err);
        await progress(
          /timeout/i.test(msg)
            ? "Recherche web trop lente. Rédaction à partir du brief (et des liens déjà lus)."
            : "Recherche web en échec. Rédaction à partir du brief.",
        );
        const { collectDeepSources } = await import("@/lib/research/collect");
        const { buildDossierFromDocuments } = await import(
          "@/lib/research/build-dossier"
        );
        const { evaluateDossierQuality } = await import(
          "@/lib/research/quality"
        );
        const seedCollect = await collectDeepSources({
          title: subject.title,
          sourceUrl: subject.sourceUrl,
          extraSourceUrls: subject.extraSourceUrls,
          sourceText: subject.sourceText || seedText,
          skipWebSearch: true,
        });
        const dossier = await buildDossierFromDocuments({
          subject: subject.title,
          sourceUrl: subject.sourceUrl,
          sources: seedCollect.sources,
          secondaryCaption: subject.caption,
          fast: true,
        });
        const quality = evaluateDossierQuality(dossier);
        dossier.quality = quality.scores;
        dossier.qualityNotes = [
          ...(quality.notes || []),
          `Recherche web interrompue : ${msg}`,
        ];
        dossier.coverage = quality.coverage;
        return { dossier, quality };
      }
    })();
    timer.end("research");
    stagesRun.push("research", "quality_gate");
    await progress(
      `Dossier prêt (${dossier.sources?.length || 0} sources, ${dossier.keyFacts?.length || 0} faits). Rédaction…`,
    );

    try {
      timer.start("writing");
      setTokenMeterStage("writing");
      const written = await withTimeout(
        runWritingAgent({
          dossier,
          subjectTitle: subject.title,
          fast: opts?.fast,
          investigation: opts?.investigation,
          editorialBrief: opts?.editorialBrief,
        }),
        writingTimeoutMs,
        "Timeout writing",
      );
      timer.end("writing");
      stagesRun.push("writing");

      dossier.extensions = {
        ...(dossier.extensions || {}),
        writingMetadata: written.metadata,
      };

      const observability = finalizeObservability({
        runId,
        mode: "research_write",
        startedAtMs,
        timer,
        quality,
        writingMetadata: written.metadata,
        dossier,
        includeDossier: opts?.includeDossierInObservability,
      });

      return {
        subject,
        dossier,
        quality,
        writingMetadata: written.metadata,
        artifacts: { article: written.article },
        stagesRun,
        mode: "research_write",
        observability,
      };
    } catch (writeErr) {
      if (opts?.investigation) {
        throw writeErr instanceof Error
          ? writeErr
          : new Error("Échec rédaction enquête");
      }
      console.error(
        "Writing Agent failed — fallback legacy with dossier",
        writeErr,
      );
      const { serializeDossierForWriter } = await import("@/lib/research/agent");
      const dossierNotes = serializeDossierForWriter(dossier);

      timer.start("writing_legacy_fallback");
      setTokenMeterStage("writing_legacy_fallback");
      const article = await generateArticleLegacy({
        title: subject.title,
        sourceText: [subject.sourceText, dossierNotes]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 14000),
        sourceUrl: subject.sourceUrl,
      });
      timer.end("writing_legacy_fallback");
      stagesRun.push("writing");

      const writingMetadata = {
        plan: [] as string[],
        sectionsUsed: [] as string[],
        sectionsIgnored: [] as string[],
        unusedDossierElements: [] as string[],
        warnings: [
          `Writing Agent échec — fallback legacy: ${
            writeErr instanceof Error ? writeErr.message : "erreur"
          }`,
        ],
        wordCount: article.content.split(/\s+/).filter(Boolean).length,
        structureVariant: "legacy_fallback",
      };

      const observability = finalizeObservability({
        runId,
        mode: "research_write",
        startedAtMs,
        timer,
        quality,
        writingMetadata,
        dossier,
        includeDossier: opts?.includeDossierInObservability,
      });

      return {
        subject,
        dossier,
        quality,
        writingMetadata,
        artifacts: { article },
        stagesRun,
        mode: "research_write",
        observability,
      };
    }
  } catch (err) {
    if (opts?.investigation) {
      throw err instanceof Error ? err : new Error("Échec recherche enquête");
    }
    console.error("editorial pipeline research failed — fallback legacy", err);
    // Mode sourceFirst : pas d'invention hors source — on remonte l'erreur.
    if (opts?.sourceFirst && subject.sourceText) {
      throw err instanceof Error
        ? err
        : new Error("Échec pipeline ancré sur la source");
    }
    timer.start("writing_legacy");
    setTokenMeterStage("writing_legacy");
    const article = await generateArticleLegacy(subject);
    timer.end("writing_legacy");
    stagesRun.push("writing");

    const observability = finalizeObservability({
      runId,
      mode: "legacy",
      startedAtMs,
      timer,
      quality: null,
      writingMetadata: null,
      dossier: null,
      includeDossier: opts?.includeDossierInObservability,
    });

    return {
      subject,
      dossier: null,
      quality: null,
      writingMetadata: null,
      artifacts: { article },
      stagesRun,
      mode: "legacy",
      observability,
    };
  }
}

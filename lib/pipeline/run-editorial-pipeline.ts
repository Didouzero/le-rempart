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

export type RunEditorialPipelineOptions = {
  /** Inclure le dossier complet dans observability (dev / eval). */
  includeDossierInObservability?: boolean;
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

  try {
    timer.start("research");
    setTokenMeterStage("research");
    const { dossier, quality } = await runResearchAgent(subject);
    timer.end("research");
    stagesRun.push("research", "quality_gate");

    try {
      timer.start("writing");
      setTokenMeterStage("writing");
      const written = await runWritingAgent({
        dossier,
        subjectTitle: subject.title,
      });
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
    console.error("editorial pipeline research failed — fallback legacy", err);
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

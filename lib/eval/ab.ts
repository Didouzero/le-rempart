import {
  compareMetrics,
  computeArticleMetrics,
  type AbComparison,
  type ArticleQualityMetrics,
} from "@/lib/eval/compare";
import {
  createRunId,
  finalizeObservability,
  StageTimer,
  type PipelineObservability,
} from "@/lib/eval/observability";
import { beginTokenMeter, setTokenMeterStage } from "@/lib/eval/token-meter";
import { generateArticleLegacy } from "@/lib/kimi-legacy";
import type { ArticleArtifact, PipelineSubject } from "@/lib/pipeline/types";
import { runEditorialPipeline } from "@/lib/pipeline/run-editorial-pipeline";

export type AbArmResult = {
  article: ArticleArtifact;
  metrics: ArticleQualityMetrics;
  observability: PipelineObservability;
};

export type AbEvalResult = {
  subject: PipelineSubject;
  legacy: AbArmResult;
  neu: AbArmResult;
  comparison: AbComparison;
};

/**
 * Bras A — ancien pipeline monolithique (sans Research/Writing séparés).
 */
export async function runLegacyArm(
  subject: PipelineSubject,
  opts?: { includeDossier?: boolean },
): Promise<AbArmResult> {
  const runId = createRunId();
  const startedAtMs = Date.now();
  const timer = new StageTimer();
  beginTokenMeter("writing_legacy");
  timer.start("writing_legacy");
  setTokenMeterStage("writing_legacy");

  const article = await generateArticleLegacy({
    title: subject.title,
    sourceText: subject.sourceText,
    sourceUrl: subject.sourceUrl,
  });

  timer.end("writing_legacy");

  const observability = finalizeObservability({
    runId,
    mode: "legacy",
    startedAtMs,
    timer,
    quality: null,
    writingMetadata: null,
    dossier: null,
    includeDossier: opts?.includeDossier,
  });

  return {
    article,
    metrics: computeArticleMetrics(article),
    observability,
  };
}

/**
 * Bras B — nouveau pipeline (Research → Writing).
 */
export async function runNewArm(
  subject: PipelineSubject,
  opts?: { includeDossier?: boolean },
): Promise<AbArmResult> {
  const result = await runEditorialPipeline(subject, {
    includeDossierInObservability: opts?.includeDossier ?? true,
  });
  const article = result.artifacts.article;
  if (!article) throw new Error("Nouveau pipeline : aucun article");

  return {
    article,
    metrics: computeArticleMetrics(article),
    observability: result.observability,
  };
}

/**
 * Comparaison A/B pour un même sujet.
 */
export async function runAbEvaluation(
  subject: PipelineSubject,
  opts?: { includeDossier?: boolean },
): Promise<AbEvalResult> {
  // Séquentiel pour éviter de saturer Moonshot / scrapers.
  const legacy = await runLegacyArm(subject, opts);
  const neu = await runNewArm(subject, opts);
  return {
    subject,
    legacy,
    neu,
    comparison: compareMetrics(legacy.metrics, neu.metrics, {
      newCoverage: neu.observability.coverage,
      writingMetadata: neu.observability.writingMetadata,
    }),
  };
}

import {
  endTokenMeter,
  sumTokenUsage,
  type TokenUsage,
} from "@/lib/eval/token-meter";
import type { DossierQualityReport } from "@/lib/research/quality";
import type { ResearchDossier } from "@/lib/research/types";
import type { WritingMetadata } from "@/lib/writing/types";

export type StageTiming = {
  stage: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

/**
 * Trace complète d'un run — destinée au développement / validation.
 */
export type PipelineObservability = {
  runId: string;
  mode: "legacy" | "research_write";
  startedAt: string;
  endedAt: string;
  totalDurationMs: number;
  timings: StageTiming[];
  tokensByStage: Record<string, TokenUsage>;
  tokensTotal: TokenUsage;
  quality: DossierQualityReport | null;
  coverage: ResearchDossier["coverage"] | null;
  writingMetadata: WritingMetadata | null;
  /** Présent si demandé (peut être volumineux). */
  dossier?: ResearchDossier | null;
};

export function createRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class StageTimer {
  private timings: StageTiming[] = [];
  private open = new Map<string, number>();

  start(stage: string): void {
    this.open.set(stage, Date.now());
  }

  end(stage: string): void {
    const t0 = this.open.get(stage);
    if (t0 == null) return;
    const endedAt = Date.now();
    this.timings.push({
      stage,
      startedAt: new Date(t0).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - t0,
    });
    this.open.delete(stage);
  }

  snapshot(): StageTiming[] {
    return [...this.timings];
  }
}

export function finalizeObservability(input: {
  runId: string;
  mode: "legacy" | "research_write";
  startedAtMs: number;
  timer: StageTimer;
  quality: DossierQualityReport | null;
  writingMetadata: WritingMetadata | null;
  dossier?: ResearchDossier | null;
  includeDossier?: boolean;
}): PipelineObservability {
  const tokensByStage = endTokenMeter();
  const endedAtMs = Date.now();
  return {
    runId: input.runId,
    mode: input.mode,
    startedAt: new Date(input.startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    totalDurationMs: endedAtMs - input.startedAtMs,
    timings: input.timer.snapshot(),
    tokensByStage,
    tokensTotal: sumTokenUsage(tokensByStage),
    quality: input.quality,
    coverage: input.dossier?.coverage ?? input.quality?.coverage ?? null,
    writingMetadata: input.writingMetadata,
    dossier: input.includeDossier ? input.dossier ?? null : undefined,
  };
}

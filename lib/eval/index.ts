export {
  runAbEvaluation,
  runLegacyArm,
  runNewArm,
  type AbArmResult,
  type AbEvalResult,
} from "@/lib/eval/ab";

export {
  compareMetrics,
  computeArticleMetrics,
  type AbComparison,
  type ArticleQualityMetrics,
} from "@/lib/eval/compare";

export {
  QUALITATIVE_CRITERIA,
  CRITERION_LABELS,
  buildGlobalAbScores,
  renderManualScorecardMarkdown,
  type GlobalAbScores,
  type ManualScorecard,
  type PublishChoice,
} from "@/lib/eval/scorecard";

export {
  createRunId,
  finalizeObservability,
  StageTimer,
  type PipelineObservability,
  type StageTiming,
} from "@/lib/eval/observability";

export type { TokenUsage } from "@/lib/eval/token-meter";

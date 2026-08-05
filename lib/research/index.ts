export {
  RESEARCH_DOSSIER_SCHEMA_VERSION,
  RESEARCH_DOSSIER_VERSION,
  emptyResearchDossier,
  type ActorKind,
  type ChronologyEvent,
  type Citation,
  type CollectedDocument,
  type ConceptToExplain,
  type ConfidenceLevel,
  type DossierCoverage,
  type DossierExtensions,
  type DossierQualityScores,
  type GlossaryEntry,
  type KnowledgeEdge,
  type KnowledgeEdgeType,
  type KnowledgeFact,
  type KnowledgeGraph,
  type KnowledgeNode,
  type KnowledgeNodeType,
  type NaiveQuestion,
  type ResearchActor,
  type ResearchDossier,
  type SourceDocument,
  type SourceRef,
  type SourceType,
  type VerificationStatus,
  type VerifiedClaim,
} from "@/lib/research/types";

export {
  DOSSIER_QUALITY_THRESHOLDS,
  evaluateDossierQuality,
  shouldEnrichDossier,
  toQualityDiagnostic,
  type DossierQualityReport,
  type QualityDimension,
} from "@/lib/research/quality";

export { computeDossierCoverage } from "@/lib/research/coverage";

export {
  confidenceFromTier,
  enrichSourceWithTier,
  estimateSourceTier,
  isReliableSource,
  rankingScoreFromTier,
  SOURCE_TIER_LABELS,
  type SourceTier,
} from "@/lib/research/source-hierarchy";

export {
  runResearchAgent,
  serializeDossierForWriter,
  type ResearchAgentInput,
  type ResearchAgentResult,
} from "@/lib/research/agent";

export { collectDeepSources, discoverSourceCandidates } from "@/lib/research/collect";

export {
  searchWebForSubject,
  buildWebSearchQueries,
  type WebSearchHit,
} from "@/lib/research/web-search";
export {
  buildDossierFromDocuments,
  mergeDossiers,
} from "@/lib/research/build-dossier";

export { dossierForPersistence } from "@/lib/research/persist";

import type { PipelineObservability } from "@/lib/eval/observability";
import type { DossierQualityReport } from "@/lib/research/quality";
import type { ResearchDossier } from "@/lib/research/types";
import type { WritingMetadata } from "@/lib/writing/types";

/**
 * Étapes du pipeline éditorial.
 * research → quality_gate → writing sont actives (A–D).
 * editor / fact_check sont réservées pour plus tard, sans refonte.
 */
export type PipelineStageId =
  | "research"
  | "quality_gate"
  | "writing"
  | "editor"
  | "fact_check"
  | "publication";

/**
 * Formats éditoriaux dérivables du même ResearchDossier.
 * Seul "article" est produit aujourd'hui ; les autres sont des slots futurs.
 */
export type EditorialFormat =
  | "article"
  | "flash_info"
  | "facebook"
  | "x_thread"
  | "newsletter"
  | "youtube"
  | "faq";

export type PipelineSubject = {
  /** Sujet documentaire (titre source / headline) — pas l'accroche Canva. */
  title: string;
  /** Texte source riche (admin / scrape) — pas une caption. */
  sourceText?: string;
  /** Entrée principale du Knowledge Builder (URL veille / admin). */
  sourceUrl?: string;
  /** Accroche éditoriale secondaire (Canva) — jamais source de faits. */
  caption?: string;
};

/** Forme article — alignée sur GeneratedArticle (lib/kimi). */
export type ArticleArtifact = {
  title: string;
  excerpt: string;
  content: string;
};

/**
 * Résultat d'un run pipeline.
 * Le dossier est l'actif principal ; l'article n'est qu'une représentation.
 */
export type EditorialPipelineResult = {
  subject: PipelineSubject;
  /** Actif central — null uniquement en fallback legacy total. */
  dossier: ResearchDossier | null;
  quality: DossierQualityReport | null;
  /** Métadonnées Writing → futur Editor Agent. */
  writingMetadata: WritingMetadata | null;
  /** Trace dev : timings, tokens, coverage, plan… */
  observability: PipelineObservability;
  /** Représentations éditoriales produites à partir du dossier. */
  artifacts: Partial<Record<EditorialFormat, unknown>> & {
    article?: ArticleArtifact;
  };
  /** Étapes effectivement exécutées (traçabilité). */
  stagesRun: PipelineStageId[];
  /**
   * research_write = Knowledge Builder + Writing Agent
   * legacy = ancien chemin monolithique (secours)
   */
  mode: "legacy" | "research_write";
};

export type PipelineAgentContext = {
  subject: PipelineSubject;
  dossier: ResearchDossier | null;
  quality: DossierQualityReport | null;
};

import type { ArticleArtifact } from "@/lib/pipeline/types";

/**
 * Métadonnées pour le futur Editor Agent.
 * Le Writing Agent doit les produire à chaque run.
 */
export type WritingMetadata = {
  /** Plan éditorial retenu (ordre des blocs / H2). */
  plan: string[];
  /** Sections du dossier effectivement exploitées. */
  sectionsUsed: string[];
  /** Sections du dossier volontairement non reprises (vides ou hors sujet). */
  sectionsIgnored: string[];
  /** Éléments riches du dossier non utilisés (faits, citations, acteurs…). */
  unusedDossierElements: string[];
  /** Avertissements (coverage faible, faits unverifiable, etc.). */
  warnings: string[];
  wordCount: number;
  /** Variante de structure pour casser l'effet template. */
  structureVariant: string;
};

export type WritingAgentResult = {
  article: ArticleArtifact;
  metadata: WritingMetadata;
};

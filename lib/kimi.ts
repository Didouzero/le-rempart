/**
 * API publique génération article.
 *
 * L'orchestration (research → dossier → writing) vit dans lib/pipeline.
 * Ce module conserve les exports historiques pour ne pas casser les importateurs.
 */

export {
  generateArticleLegacy,
  getKimiTextModel,
  getKimiVisionModels,
  type GeneratedArticle,
} from "@/lib/kimi-legacy";

import {
  runEditorialPipeline,
  type RunEditorialPipelineOptions,
} from "@/lib/pipeline/run-editorial-pipeline";
import type { GeneratedArticle } from "@/lib/kimi-legacy";

/**
 * Point d'entrée historique (signature stable).
 * Étape B : research (Knowledge Builder) → quality gate → writing legacy ancré sur le dossier.
 */
export async function generateArticleFromSource(input: {
  title: string;
  sourceText?: string;
  sourceUrl?: string;
  caption?: string;
}): Promise<GeneratedArticle> {
  const result = await runEditorialPipeline(input);
  const article = result.artifacts.article;
  if (!article) {
    throw new Error("Pipeline éditorial : aucun article produit");
  }
  return article;
}

/**
 * Variante qui expose le résultat complet (dossier + qualité + article).
 */
export async function generateArticlePipeline(
  input: {
    title: string;
    sourceText?: string;
    sourceUrl?: string;
    caption?: string;
  },
  opts?: RunEditorialPipelineOptions,
) {
  return runEditorialPipeline(input, opts);
}

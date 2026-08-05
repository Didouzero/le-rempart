import type { ArticleArtifact } from "@/lib/pipeline/types";
import type { ArticleQualityMetrics } from "@/lib/eval/metrics-types";
import type { GlobalAbScores } from "@/lib/eval/scorecard";
import { buildGlobalAbScores } from "@/lib/eval/scorecard";
import type { DossierCoverage } from "@/lib/research/types";
import type { WritingMetadata } from "@/lib/writing/types";

export type { ArticleQualityMetrics };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9àâäéèêëïîôùûüç\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function countMatches(text: string, re: RegExp): number {
  return [...text.matchAll(re)].length;
}

function repetitionScore(paragraphs: string[]): number {
  if (paragraphs.length < 2) return 0;
  let hits = 0;
  let comparisons = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    for (let j = i + 1; j < paragraphs.length; j += 1) {
      comparisons += 1;
      const a = tokenize(paragraphs[i]!).slice(0, 40).join(" ");
      const b = tokenize(paragraphs[j]!).slice(0, 40).join(" ");
      if (!a || !b) continue;
      const setA = new Set(a.split(" "));
      const setB = new Set(b.split(" "));
      let inter = 0;
      for (const w of setA) if (setB.has(w)) inter += 1;
      const union = setA.size + setB.size - inter || 1;
      if (inter / union > 0.55) hits += 1;
    }
  }
  return comparisons ? Math.round((hits / comparisons) * 100) : 0;
}

/**
 * Métriques heuristiques pour comparaison A/B (pas un jugement éditorial final).
 */
export function computeArticleMetrics(
  article: ArticleArtifact,
): ArticleQualityMetrics {
  const content = article.content || "";
  const words = tokenize(content);
  const unique = new Set(words);
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !/^##\s/.test(p));
  const h2Titles = [...content.matchAll(/^##\s+(.+)$/gm)].map((m) =>
    m[1]!.trim(),
  );

  const digitAnchors = countMatches(content, /\b\d[\d\s.%]{0,12}\b/g);
  const quoteCount = countMatches(content, /[«"][^»"]+[»"]/g);
  const dateLikeCount = countMatches(
    content,
    /\b(\d{1,2}\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)|\d{4})\b/gi,
  );
  const properNameHints = countMatches(
    content,
    /\b[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç'’-]+(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç'’-]+){0,2}\b/g,
  );
  const boldCount = countMatches(content, /\*\*[^*]+\*\*/g);

  let templateRisk = 0;
  if (/on croit rêver|ou plutôt cauchemarder/i.test(content)) templateRisk += 30;
  if (/Le Rempart refuse de s'en tenir/i.test(content)) templateRisk += 25;
  if (/dossier reste ouvert/i.test(content)) templateRisk += 15;
  if (h2Titles.length > 0) {
    const joined = h2Titles.join(" | ").toLowerCase();
    if (
      /les faits/.test(joined) &&
      /analyse/.test(joined) &&
      /conséquence/.test(joined)
    ) {
      templateRisk += 10;
    }
  }

  const wordCount = words.length;
  const avgParagraphWords =
    paragraphs.length > 0
      ? Math.round(wordCount / paragraphs.length)
      : wordCount;
  const uniqueWordRatio =
    wordCount > 0 ? Math.round((unique.size / wordCount) * 100) : 0;

  const anchors = digitAnchors + quoteCount + dateLikeCount;
  const densityScore =
    wordCount > 0 ? Math.round((anchors / wordCount) * 1000) / 10 : 0;

  return {
    wordCount,
    charCount: content.length,
    paragraphCount: paragraphs.length,
    h2Count: h2Titles.length,
    h2Titles,
    uniqueWordRatio,
    avgParagraphWords,
    digitAnchors,
    quoteCount,
    dateLikeCount,
    properNameHints,
    boldCount,
    repetitionScore: repetitionScore(paragraphs),
    templateRisk: Math.min(100, templateRisk),
    seoTitleLength: article.title.length,
    seoExcerptLength: article.excerpt.length,
    densityScore,
  };
}

export type AbComparison = {
  legacy: ArticleQualityMetrics;
  neu: ArticleQualityMetrics;
  deltas: Record<string, number>;
  summary: string[];
  /** Indicateur global proxy (accélère la revue, ne décide pas). */
  global: GlobalAbScores;
};

export function compareMetrics(
  legacy: ArticleQualityMetrics,
  neu: ArticleQualityMetrics,
  extras?: {
    newCoverage?: DossierCoverage | null;
    writingMetadata?: WritingMetadata | null;
  },
): AbComparison {
  const keys: Array<keyof ArticleQualityMetrics> = [
    "wordCount",
    "paragraphCount",
    "h2Count",
    "uniqueWordRatio",
    "digitAnchors",
    "quoteCount",
    "dateLikeCount",
    "repetitionScore",
    "templateRisk",
    "densityScore",
  ];

  const deltas: Record<string, number> = {};
  for (const k of keys) {
    const a = legacy[k];
    const b = neu[k];
    if (typeof a === "number" && typeof b === "number") {
      deltas[k] = Math.round((b - a) * 10) / 10;
    }
  }

  const global = buildGlobalAbScores({
    legacyMetrics: legacy,
    newMetrics: neu,
    newCoverage: extras?.newCoverage,
    writingMetadata: extras?.writingMetadata,
  });

  const summary: string[] = [...global.headline];
  if (deltas.wordCount > 150) summary.push("Nouveau nettement plus long");
  if (deltas.wordCount < -150) summary.push("Nouveau plus court");
  if (deltas.densityScore > 0.3) summary.push("Densité informative ↑");
  if (deltas.densityScore < -0.3) summary.push("Densité informative ↓");
  if (deltas.digitAnchors > 2) summary.push("Plus d'ancrages chiffrés");
  if (deltas.quoteCount > 0) summary.push("Plus de citations");
  if (deltas.repetitionScore < -5) summary.push("Moins de répétitions");
  if (deltas.repetitionScore > 5) summary.push("Plus de répétitions");
  if (deltas.templateRisk < -10) summary.push("Risque template ↓");
  if (deltas.templateRisk > 10) summary.push("Risque template ↑");
  if (summary.length <= global.headline.length) {
    summary.push("Écarts métriques modérés — revue manuelle nécessaire");
  }

  return { legacy, neu, deltas, summary, global };
}

export type ArticleQualityMetrics = {
  wordCount: number;
  charCount: number;
  paragraphCount: number;
  h2Count: number;
  h2Titles: string[];
  uniqueWordRatio: number;
  avgParagraphWords: number;
  digitAnchors: number;
  quoteCount: number;
  dateLikeCount: number;
  properNameHints: number;
  boldCount: number;
  repetitionScore: number;
  templateRisk: number;
  seoTitleLength: number;
  seoExcerptLength: number;
  densityScore: number;
};

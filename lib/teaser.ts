/** Nombre de mots montrés aux non-abonnés : environ 10 à 12 lignes dans la colonne de lecture. */
export const TEASER_WORDS = 230;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Début d'une enquête, coupé côté serveur : le reste du texte n'est jamais envoyé
 * au navigateur. Garde les paragraphes entiers, puis complète phrase par phrase
 * jusqu'à la limite.
 */
export function teaserMarkdown(markdown: string, maxWords = TEASER_WORDS): string {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const kept: string[] = [];
  let words = 0;

  for (const block of blocks) {
    // Pas d'image, de vidéo ni d'intertitre en fin d'aperçu.
    if (/^(!\[|<|https?:\/\/\S+$)/.test(block)) continue;
    const n = wordCount(block);
    if (words + n <= maxWords) {
      kept.push(block);
      words += n;
      continue;
    }
    // Complète avec les premières phrases du paragraphe suivant.
    const sentences = block.match(/[^.!?…]+[.!?…]+["»”]?\s*/g) ?? [block];
    const partial: string[] = [];
    for (const sentence of sentences) {
      const m = wordCount(sentence);
      if (words + m > maxWords && (partial.length > 0 || kept.length > 0)) break;
      partial.push(sentence.trim());
      words += m;
    }
    if (partial.length > 0) kept.push(partial.join(" "));
    break;
  }

  while (kept.length > 0 && /^#{1,6}\s/.test(kept[kept.length - 1]!)) kept.pop();
  return kept.join("\n\n");
}

/** Nombre de mots montrés aux non-abonnés : environ 10 à 12 lignes dans la colonne de lecture. */
export const TEASER_WORDS = 230;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Coupe une enquête en deux : l'aperçu montré à tous, et la suite réservée aux abonnés.
 * Garde les paragraphes entiers, puis complète phrase par phrase jusqu'à la limite.
 * Les images et vidéos d'avant la coupe ne sont ni dans l'aperçu ni dans la suite.
 */
export function splitTeaser(
  markdown: string,
  maxWords = TEASER_WORDS,
): { teaser: string; rest: string } {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const kept: string[] = [];
  const rest: string[] = [];
  let words = 0;
  let i = 0;

  for (; i < blocks.length; i++) {
    const block = blocks[i]!;
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
    let s = 0;
    for (; s < sentences.length; s++) {
      const m = wordCount(sentences[s]!);
      if (words + m > maxWords && (partial.length > 0 || kept.length > 0)) break;
      partial.push(sentences[s]!.trim());
      words += m;
    }
    if (partial.length > 0) kept.push(partial.join(" "));
    // La suite reprend le paragraphe là où l'aperçu s'arrête, fin sans ponctuation comprise.
    const consumed = sentences.slice(0, s).join("");
    const tail = (
      block.startsWith(consumed)
        ? block.slice(consumed.length)
        : sentences.slice(s).join("")
    ).trim();
    if (tail) rest.push(tail);
    i++;
    break;
  }

  // Un intertitre resté en fin d'aperçu passe en tête de la suite.
  while (kept.length > 0 && /^#{1,6}\s/.test(kept[kept.length - 1]!)) {
    rest.unshift(kept.pop()!);
  }
  rest.push(...blocks.slice(i));
  return { teaser: kept.join("\n\n"), rest: rest.join("\n\n") };
}

/** Début d'une enquête, coupé côté serveur : le reste n'est envoyé qu'aux abonnés et à Googlebot. */
export function teaserMarkdown(markdown: string, maxWords = TEASER_WORDS): string {
  return splitTeaser(markdown, maxWords).teaser;
}

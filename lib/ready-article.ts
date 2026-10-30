/**
 * Article déjà rédigé, envoyé au bot à la place du sujet : le bot le publie tel quel.
 *
 * TITRE : …
 * CHAPO : …
 * A LIRE AUSSI : 123, 456      (facultatif)
 * FLASH :
 * …
 * ARTICLE :
 * …
 */

export type ReadyArticle = {
  title: string;
  excerpt: string;
  flash: string;
  content: string;
  readAlsoIds: number[];
};

export function looksLikeReadyArticle(text: string): boolean {
  return /^\s*TITRE\s*:/i.test(text);
}

/** Lève une erreur explicite : un texte incomplet ne doit jamais partir en sujet chez Kimi. */
export function parseReadyArticle(text: string): ReadyArticle {
  const m = text.match(
    /^\s*TITRE\s*:\s*(.+?)\s*\n+\s*CHAP[OÔ]\s*:\s*([\s\S]+?)\s*\n+(?:\s*A LIRE AUSSI\s*:\s*(.*?)\s*\n+)?\s*FLASH\s*:\s*\n([\s\S]+?)\n+\s*ARTICLE\s*:\s*\n([\s\S]+)$/i,
  );
  if (!m) {
    throw new Error(
      "Texte prêt incomplet : il faut, dans l'ordre, TITRE :, CHAPO :, FLASH : et ARTICLE :.",
    );
  }
  return {
    title: m[1]!.trim(),
    excerpt: m[2]!.trim(),
    readAlsoIds: (m[3] || "").match(/\d+/g)?.map(Number).slice(0, 2) ?? [],
    flash: m[4]!.trim(),
    content: m[5]!.trim(),
  };
}

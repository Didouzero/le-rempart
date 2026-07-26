const GOLD = "#ffbd59";
const WHITE = "#ffffff";

/** Approx. largeur relative Impact (condensé). */
function impactCharWidth(ch: string): number {
  if (ch === " ") return 0.28;
  if ("MW@".includes(ch)) return 0.72;
  if ("IL1!|i.,:;".includes(ch)) return 0.28;
  if ("ABCDEFGHJKNOPQRSTUVXYZÀÂÄÉÈÊËÏÎÔÙÛÜÇ".includes(ch)) return 0.52;
  return 0.48;
}

export function measureImpactLine(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    w += impactCharWidth(ch) * fontSize;
  }
  return w;
}

function lineWidthVariance(lines: string[], fontSize: number): number {
  const widths = lines.map((l) => measureImpactLine(l, fontSize));
  const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
  return (
    widths.reduce((acc, w) => acc + (w - avg) ** 2, 0) / Math.max(widths.length, 1)
  );
}

/** Découpe les mots en `lineCount` lignes aussi équilibrées que possible. */
function splitIntoNLines(words: string[], lineCount: number): string[] {
  if (words.length === 0) return [];
  if (lineCount <= 1) return [words.join(" ")];
  if (words.length <= lineCount) {
    const lines = words.map((w) => w);
    while (lines.length < lineCount) lines.push("");
    return lines.filter(Boolean);
  }

  const total = words.length;
  const base = Math.floor(total / lineCount);
  let rem = total % lineCount;
  const counts: number[] = [];
  for (let i = 0; i < lineCount; i++) {
    counts.push(base + (rem > 0 ? 1 : 0));
    if (rem > 0) rem -= 1;
  }

  // Ajuste pour minimiser l'écart de largeur
  let best = counts.slice();
  let bestVar = Infinity;
  for (let iter = 0; iter < 40; iter++) {
    const lines: string[] = [];
    let idx = 0;
    for (const n of counts) {
      lines.push(words.slice(idx, idx + n).join(" "));
      idx += n;
    }
    const v = lineWidthVariance(lines, 64);
    if (v < bestVar) {
      bestVar = v;
      best = counts.slice();
    }
    // Petite mutation : déplacer un mot entre deux lignes
    const from = iter % lineCount;
    const to = (from + 1) % lineCount;
    if (counts[from] > 1) {
      counts[from] -= 1;
      counts[to] += 1;
    }
  }

  const lines: string[] = [];
  let idx = 0;
  for (const n of best) {
    lines.push(words.slice(idx, idx + n).join(" "));
    idx += n;
  }
  return lines;
}

/**
 * Titre Canva : majuscules, 4 ou 5 lignes équilibrées.
 * `highlightWords` = mots (sans casse) à colorer en or.
 */
export function layoutTitleLines(
  title: string,
  highlightWords: string[] = [],
): { lines: string[]; highlightSet: Set<string> } {
  const cleaned = title
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/['']/g, "'");

  const words = cleaned.split(" ").filter(Boolean);
  const highlightSet = new Set(
    highlightWords.map((w) =>
      w
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}']+/gu, ""),
    ),
  );

  const candidates = [4, 5].filter((n) => n <= Math.max(words.length, 1));
  let bestLines = splitIntoNLines(words, candidates[0] || 4);
  let bestVar = lineWidthVariance(bestLines, 64);

  for (const n of candidates) {
    const lines = splitIntoNLines(words, n);
    const v = lineWidthVariance(lines, 64);
    if (v < bestVar) {
      bestVar = v;
      bestLines = lines;
    }
  }

  // Réduit la taille cible si une ligne est trop longue (signal pour le renderer)
  return { lines: bestLines, highlightSet };
}

export function foldWord(word: string): string {
  return word
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}']+/gu, "");
}

export { GOLD, WHITE };

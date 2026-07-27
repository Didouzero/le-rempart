import { sanitizeCreativeTitle } from "@/lib/creative/title-fix";

const GOLD = "#ffbd59";
const WHITE = "#ffffff";

/** Approx. largeur relative Impact (condensé). */
function impactCharWidth(ch: string): number {
  if (ch === " " || ch === "'") return 0.28;
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

function charLen(line: string): number {
  return line.replace(/\s+/g, " ").trim().length;
}

function lineWidthVariance(lines: string[], fontSize: number): number {
  const widths = lines.map((l) => measureImpactLine(l, fontSize));
  const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
  return (
    widths.reduce((acc, w) => acc + (w - avg) ** 2, 0) /
    Math.max(widths.length, 1)
  );
}

/** Pénalise les lignes trop courtes vs la plus longue (ex. "SEULEMENT 10"). */
function balanceScore(lines: string[], fontSize: number): number {
  const widths = lines.map((l) => measureImpactLine(l, fontSize));
  const maxW = Math.max(...widths, 1);
  const minW = Math.min(...widths);
  const variance = lineWidthVariance(lines, fontSize);
  const shortPenalty = minW / maxW < 0.72 ? (0.72 - minW / maxW) * 50_000 : 0;
  const lenPenalty = lines.reduce((acc, l) => {
    const n = charLen(l);
    if (n < 18) return acc + (18 - n) * 800;
    return acc;
  }, 0);
  return variance + shortPenalty + lenPenalty;
}

/** Découpe les mots en `lineCount` lignes aussi équilibrées que possible. */
function splitIntoNLines(words: string[], lineCount: number): string[] {
  if (words.length === 0) return [];
  if (lineCount <= 1) return [words.join(" ")];
  if (words.length < lineCount) {
    // Pas assez de mots : on regroupe sur le max possible
    return splitIntoNLines(words, words.length);
  }

  const totalWidth = measureImpactLine(words.join(" "), 64);
  const target = totalWidth / lineCount;

  // DP : minimise l'écart au target + équilibre global
  const n = words.length;
  const prefix: number[] = [0];
  for (let i = 0; i < n; i++) {
    prefix.push(
      measureImpactLine(words.slice(0, i + 1).join(" "), 64),
    );
  }
  const widthBetween = (i: number, j: number) => prefix[j] - prefix[i];

  const INF = 1e15;
  const dp: number[][] = Array.from({ length: lineCount + 1 }, () =>
    Array(n + 1).fill(INF),
  );
  const prev: number[][] = Array.from({ length: lineCount + 1 }, () =>
    Array(n + 1).fill(-1),
  );
  dp[0][0] = 0;

  for (let k = 1; k <= lineCount; k++) {
    for (let j = k; j <= n; j++) {
      for (let i = k - 1; i < j; i++) {
        const wordsInLine = j - i;
        if (wordsInLine < 1) continue;
        // Évite une dernière ligne avec trop peu de mots si possible
        if (k < lineCount && j - i === 1 && n - j >= lineCount - k) {
          // ok to have 1 word only if forced later
        }
        const w = widthBetween(i, j);
        const cost = dp[k - 1][i] + (w - target) ** 2;
        if (cost < dp[k][j]) {
          dp[k][j] = cost;
          prev[k][j] = i;
        }
      }
    }
  }

  const cuts: number[] = [];
  let j = n;
  for (let k = lineCount; k >= 1; k--) {
    const i = prev[k][j];
    if (i < 0) {
      // fallback equal counts
      return equalCounts(words, lineCount);
    }
    cuts.push(i);
    j = i;
  }
  cuts.reverse();

  const lines: string[] = [];
  for (let k = 0; k < lineCount; k++) {
    const start = cuts[k];
    const end = k + 1 < lineCount ? cuts[k + 1] : n;
    lines.push(words.slice(start, end).join(" "));
  }
  return lines.filter(Boolean);
}

function equalCounts(words: string[], lineCount: number): string[] {
  const total = words.length;
  const base = Math.floor(total / lineCount);
  let rem = total % lineCount;
  const counts: number[] = [];
  for (let i = 0; i < lineCount; i++) {
    counts.push(base + (rem > 0 ? 1 : 0));
    if (rem > 0) rem -= 1;
  }
  const lines: string[] = [];
  let idx = 0;
  for (const c of counts) {
    lines.push(words.slice(idx, idx + c).join(" "));
    idx += c;
  }
  return lines;
}

/**
 * Titre Canva : majuscules, 4 ou 5 lignes équilibrées et denses.
 * `highlightWords` = mots (sans casse) à colorer en or.
 */
export function layoutTitleLines(
  title: string,
  highlightWords: string[] = [],
): { lines: string[]; highlightSet: Set<string> } {
  const cleaned = sanitizeCreativeTitle(title);

  // Ne pas casser L'AGRESSEUR : on split sur espaces seulement
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

  // 4 ou 5 lignes ; dès 14 mots → 5 lignes (titres Impact plus massifs, calés template)
  const preferFive = words.length >= 14 && words.length >= 5;
  const targetLines = preferFive
    ? 5
    : Math.min(4, Math.max(words.length, 1));
  let bestLines = splitIntoNLines(words, Math.min(targetLines, words.length));

  // Fusionne seulement au-dessus de 5 ; on garde 4–5 lignes
  bestLines = mergeShortLines(bestLines, preferFive ? 5 : 4);

  const rebalanced = rebalanceByMovingWords(bestLines);
  if (
    rebalanced.length === bestLines.length &&
    balanceScore(rebalanced, 64) < balanceScore(bestLines, 64)
  ) {
    bestLines = rebalanced;
  }

  return { lines: bestLines, highlightSet };
}

/** Déplace des mots entre lignes voisines pour égaliser les largeurs Impact. */
function rebalanceByMovingWords(lines: string[]): string[] {
  const parts = lines.map((l) => l.split(/\s+/).filter(Boolean));
  if (parts.length < 2) return lines;

  for (let iter = 0; iter < 24; iter++) {
    const widths = parts.map((p) => measureImpactLine(p.join(" "), 64));
    const maxW = Math.max(...widths);
    const minW = Math.min(...widths);
    if (minW / maxW >= 0.78) break;

    const longIdx = widths.indexOf(maxW);
    const shortIdx = widths.indexOf(minW);
    // Ne déplace qu'entre voisins
    if (Math.abs(longIdx - shortIdx) !== 1) {
      // pousse vers le voisin le plus court adjacent au long
      const left = longIdx - 1;
      const right = longIdx + 1;
      let target = shortIdx;
      if (left >= 0 && right < parts.length) {
        target = widths[left] <= widths[right] ? left : right;
      } else if (left >= 0) target = left;
      else if (right < parts.length) target = right;
      else break;

      if (target < longIdx && parts[longIdx].length > 1) {
        const word = parts[longIdx].shift()!;
        parts[target].push(word);
      } else if (target > longIdx && parts[longIdx].length > 1) {
        const word = parts[longIdx].pop()!;
        parts[target].unshift(word);
      } else break;
      continue;
    }

    if (longIdx < shortIdx && parts[longIdx].length > 1) {
      const word = parts[longIdx].pop()!;
      parts[shortIdx].unshift(word);
    } else if (longIdx > shortIdx && parts[longIdx].length > 1) {
      const word = parts[longIdx].shift()!;
      parts[shortIdx].push(word);
    } else break;
  }

  return parts.map((p) => p.join(" "));
}

function lineRatio(lines: string[]): number {
  const widths = lines.map((l) => measureImpactLine(l, 64));
  const maxW = Math.max(...widths, 1);
  const minW = Math.min(...widths);
  return minW / maxW;
}

/** Fusionne la ligne la plus courte avec un voisin tant que le ratio est mauvais. */
function mergeShortLines(lines: string[], minLines = 4): string[] {
  const out = lines.map((l) => l.trim()).filter(Boolean);
  while (out.length > minLines && lineRatio(out) < 0.72) {
    let shortIdx = 0;
    let shortW = Infinity;
    for (let i = 0; i < out.length; i++) {
      const w = measureImpactLine(out[i], 64);
      if (w < shortW) {
        shortW = w;
        shortIdx = i;
      }
    }
    const left = shortIdx - 1;
    const right = shortIdx + 1;
    let mergeInto = left >= 0 ? left : right;
    if (left >= 0 && right < out.length) {
      const leftW = measureImpactLine(out[left], 64);
      const rightW = measureImpactLine(out[right], 64);
      mergeInto = leftW <= rightW ? left : right;
    }
    if (mergeInto < shortIdx) {
      out[mergeInto] = `${out[mergeInto]} ${out[shortIdx]}`.trim();
      out.splice(shortIdx, 1);
    } else {
      out[shortIdx] = `${out[shortIdx]} ${out[mergeInto]}`.trim();
      out.splice(mergeInto, 1);
    }
  }
  return out;
}

export function foldWord(word: string): string {
  return word
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}']+/gu, "");
}

export { GOLD, WHITE };

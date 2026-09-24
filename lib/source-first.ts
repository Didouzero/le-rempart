/**
 * Garde-fou : le titre Canva n'est pas une source.
 * Une peine / durée dans l'accroche, absente du texte source (+ web),
 * ne doit jamais se retrouver dans l'article ou le flash.
 */

const WORD_TO_DIGIT: Record<string, string> = {
  un: "1",
  une: "1",
  deux: "2",
  trois: "3",
  quatre: "4",
  cinq: "5",
  six: "6",
  sept: "7",
  huit: "8",
  neuf: "9",
  dix: "10",
  onze: "11",
  douze: "12",
  treize: "13",
  quatorze: "14",
  quinze: "15",
  vingt: "20",
  trente: "30",
  quarante: "40",
  cinquante: "50",
};

const PENALTY_RE =
  /\b(\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|vingt|trente|quarante|cinquante)\s+(ans?|mois)(?:\s+(?:de\s+)?(?:prison|reclusion|reclusion criminelle|ferme|sursis))?\b/gi;

export function foldFactText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDigit(raw: string): string {
  const w = foldFactText(raw);
  if (/^\d+$/.test(w)) return String(parseInt(w, 10));
  return WORD_TO_DIGIT[w] || w;
}

/** Clés "5ans" / "18mois" présentes dans un texte. */
export function penaltyKeys(text: string): Set<string> {
  const keys = new Set<string>();
  const folded = foldFactText(text);
  const re = new RegExp(PENALTY_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(folded))) {
    const n = toDigit(m[1] || "");
    const unit = (m[2] || "").startsWith("mois") ? "mois" : "ans";
    if (n) keys.add(`${n}${unit}`);
  }
  return keys;
}

/** Peines/durées du titre absentes de la matière (source + web). */
export function unsourcedPenaltyKeys(headline: string, matter: string): string[] {
  const inMatter = penaltyKeys(matter);
  return [...penaltyKeys(headline)].filter((k) => !inMatter.has(k));
}

function keyToSearchPatterns(key: string): RegExp[] {
  const m = key.match(/^(\d+)(ans|mois)$/);
  if (!m) return [];
  const n = m[1]!;
  const unit = m[2] === "mois" ? "mois" : "ans?";
  const word = Object.entries(WORD_TO_DIGIT).find(([, d]) => d === n)?.[0];
  const num = `(?<!\\d)${n}(?!\\d)`;
  const head = word ? `(?:${num}|\\b${word}\\b)` : num;
  return [new RegExp(`${head}\\s+${unit}`, "i")];
}

export function outputUsesUnsourcedPenalties(
  output: string,
  unsourced: string[],
): string | null {
  const folded = foldFactText(output);
  for (const key of unsourced) {
    for (const re of keyToSearchPatterns(key)) {
      if (re.test(folded)) return key;
    }
  }
  return null;
}

export function assertNoUnsourcedHeadlinePenalties(input: {
  headline: string;
  matter: string;
  output: string;
  label?: string;
}): void {
  const unsourced = unsourcedPenaltyKeys(input.headline, input.matter);
  const hit = outputUsesUnsourcedPenalties(input.output, unsourced);
  if (!hit) return;
  const where = input.label || "texte";
  throw new Error(
    `${where} : peine/durée « ${hit} » reprise du titre Canva, absente de la source`,
  );
}

/** Titre site : on retire les peines Canva qui ne sont pas dans la matière. */
export function stripUnsourcedPenaltiesFromTitle(
  title: string,
  matter: string,
): string {
  const unsourced = new Set(unsourcedPenaltyKeys(title, matter));
  if (unsourced.size === 0) return title.replace(/\s+/g, " ").trim();

  let t = title.replace(/\s+/g, " ").trim();
  t = t.replace(PENALTY_RE, (full) => {
    const keys = penaltyKeys(full);
    for (const k of keys) {
      if (unsourced.has(k)) return "";
    }
    return full;
  });
  return t
    .replace(/\s+:\s+/g, " : ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/^[:\s,]+|[:\s,]+$/g, "")
    .trim();
}

/**
 * Détecte des noms de personnalités dans un titre (ex. Sébastien Lecornu).
 * Priorité pour l'illustration Wikipedia / portrait.
 */

const STOP = new Set(
  [
    "l",
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "du",
    "de",
    "d",
    "et",
    "ou",
    "mais",
    "pour",
    "dans",
    "sur",
    "avec",
    "par",
    "au",
    "aux",
    "en",
    "ce",
    "cet",
    "cette",
    "son",
    "sa",
    "ses",
    "qui",
    "que",
    "dont",
    "est",
    "sont",
    "été",
    "a",
    "ont",
    "pas",
    "plus",
    "très",
    "état",
    "etat",
    "france",
    "français",
    "francaise",
    "gouvernement",
    "ministre",
    "président",
    "president",
    "hôpital",
    "hopital",
    "après",
    "avant",
    "contre",
    "selon",
    "face",
    "vers",
    "chez",
    "sous",
    "hauts",
    "bas",
    "nord",
    "sud",
    "ouest",
    "est",
    "nouveau",
    "nouvelle",
    "annonce",
    "annonce",
    "commande",
    "inutilisables",
    "branchements",
    "italiens",
    "incompatibles",
    "clims",
    "climatiseurs",
  ].map((s) => s.toLowerCase()),
);

function toTitleCaseWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  // Particules
  if (["de", "du", "des", "d'", "l'"].includes(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeTitleCasing(title: string): string {
  const cleaned = title
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const letters = cleaned.replace(/[^\p{L}]/gu, "");
  const upperRatio =
    letters.length === 0
      ? 0
      : [...letters].filter((c) => c === c.toUpperCase() && c !== c.toLowerCase())
          .length / letters.length;

  if (upperRatio > 0.7) {
    return cleaned
      .split(" ")
      .map((w) => {
        if (w.includes("-")) {
          return w.split("-").map(toTitleCaseWord).join("-");
        }
        if (w.includes("'")) {
          const [a, ...rest] = w.split("'");
          return [toTitleCaseWord(a), ...rest.map(toTitleCaseWord)].join("'");
        }
        return toTitleCaseWord(w);
      })
      .join(" ");
  }
  return cleaned;
}

/**
 * Retourne des candidats "Prénom Nom" (et éventuellement 3 mots).
 */
export function extractPersonCandidates(title: string): string[] {
  const normalized = normalizeTitleCasing(title);
  const words = normalized.split(/\s+/).filter(Boolean);
  const out: string[] = [];

  for (let i = 0; i < words.length - 1; i += 1) {
    const a = words[i];
    const b = words[i + 1];
    const al = a.toLowerCase().replace(/^d'|^l'/, "");
    const bl = b.toLowerCase();
    if (STOP.has(al) || STOP.has(bl)) continue;
    if (a.length < 2 || b.length < 2) continue;
    // Ignore prépositions / mots trop courts type "À"
    if (a.length < 3 && !a.includes("'")) continue;
    if (b.length < 3 && !b.includes("'")) continue;
    // Doit ressembler à un nom propre (capitale)
    if (!/^\p{Lu}/u.test(a) || !/^\p{Lu}/u.test(b)) continue;

    out.push(`${a} ${b}`);

    if (i + 2 < words.length) {
      const c = words[i + 2];
      const cl = c.toLowerCase();
      if (!STOP.has(cl) && c.length >= 2 && /^\p{Lu}/u.test(c)) {
        out.push(`${a} ${b} ${c}`);
      }
    }
  }

  return [...new Set(out)].slice(0, 5);
}

/**
 * Détecte des noms de personnalités dans un titre (ex. Bruno Le Maire).
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
    "nouveau",
    "nouvelle",
    "annonce",
    "commande",
    "alors",
    "pendant",
    "tandis",
    "quand",
    "comme",
    "entre",
    "depuis",
    "tour",
    "assemblée",
    "assemblee",
    "nationale",
    "voiture",
    "représentation",
    "representation",
  ].map((s) => s.toLowerCase()),
);

/** Particules de noms propres FR (ne pas traiter comme stop au milieu d'un nom). */
const NAME_PARTICLES = new Set([
  "le",
  "la",
  "de",
  "du",
  "des",
  "d'",
  "l'",
  "van",
  "von",
]);

function toTitleCaseWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (["de", "du", "des", "d'", "l'", "le", "la", "van", "von"].includes(lower)) {
    return lower;
  }
  if (word.includes("-")) {
    return word.split("-").map(toTitleCaseWord).join("-");
  }
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

function isCapitalizedNameToken(word: string): boolean {
  return /^\p{Lu}/u.test(word) && word.replace(/['-]/g, "").length >= 2;
}

function isStopToken(word: string): boolean {
  const l = word.toLowerCase().replace(/^d'|^l'/, "");
  return STOP.has(l) || STOP.has(word.toLowerCase());
}

function isParticle(word: string): boolean {
  return NAME_PARTICLES.has(word.toLowerCase());
}

/**
 * Retourne des candidats "Prénom Nom" / "Prénom Le Nom" (Bruno Le Maire).
 */
export function extractPersonCandidates(title: string): string[] {
  const normalized = normalizeTitleCasing(title);
  const words = normalized.split(/\s+/).filter(Boolean);
  const out: string[] = [];

  for (let i = 0; i < words.length; i += 1) {
    const a = words[i];
    if (!isCapitalizedNameToken(a) || isStopToken(a) || isParticle(a)) continue;

    // Prénom + particule + Nom  (Bruno Le Maire)
    if (i + 2 < words.length && isParticle(words[i + 1])) {
      const particle = words[i + 1];
      const c = words[i + 2];
      if (isCapitalizedNameToken(c) && !isStopToken(c) && !isParticle(c)) {
        out.push(`${a} ${particle} ${c}`);
        // Aussi sans particule pour certaines pages wiki
        out.push(`${a} ${c}`);
      }
    }

    // Prénom + Nom
    if (i + 1 < words.length) {
      const b = words[i + 1];
      if (
        isCapitalizedNameToken(b) &&
        !isStopToken(b) &&
        !isParticle(b)
      ) {
        out.push(`${a} ${b}`);
        // Prénom + Nom + Nom2 (Jean-Luc already one token; Charles Michel Xavier rare)
        if (i + 2 < words.length) {
          const c = words[i + 2];
          if (
            isCapitalizedNameToken(c) &&
            !isStopToken(c) &&
            !isParticle(c)
          ) {
            out.push(`${a} ${b} ${c}`);
          }
        }
      }
    }
  }

  // Priorité aux formes à 3 mots (Bruno Le Maire avant Bruno Maire)
  out.sort((x, y) => y.split(" ").length - x.split(" ").length);

  return [...new Set(out)].slice(0, 6);
}

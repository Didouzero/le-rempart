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
    "allah",
    "dieu",
    "god",
    "jesus",
    "christ",
    "tour",
    "france",
    "paris",
    "migrant",
    "migrants",
    "femme",
    "femmes",
    "homme",
    "hommes",
    "enceinte",
    "poignarde",
    "poignardé",
    "desequilibre",
    "déséquilibré",
    "desequilibre",
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
 * Personnalités FR fréquentes → titre Wikipedia canonique.
 * Permet de matcher même un nom seul (« ATTAL », « Macron »).
 */
const KNOWN_POLITICIANS: Array<{ re: RegExp; wiki: string }> = [
  { re: /\bgabriel\s+attal\b|\battal\b/i, wiki: "Gabriel Attal" },
  { re: /\bemmanuel\s+macron\b|\bmacron\b/i, wiki: "Emmanuel Macron" },
  { re: /\bjordan\s+bardella\b|\bbardella\b/i, wiki: "Jordan Bardella" },
  { re: /\bmarine\s+le\s+pen\b|\ble\s+pen\b/i, wiki: "Marine Le Pen" },
  { re: /\bjean[- ]luc\s+m[eé]lenchon\b|\bm[eé]lenchon\b/i, wiki: "Jean-Luc Mélenchon" },
  { re: /\bbruno\s+retailleau\b|\bretailleau\b/i, wiki: "Bruno Retailleau" },
  { re: /\bg[eé]rald\s+darmanin\b|\bdarmanin\b/i, wiki: "Gérald Darmanin" },
  { re: /\b[eé]ric\s+ciotti\b|\bciotti\b/i, wiki: "Éric Ciotti" },
  { re: /\blaure?nt\s+wauquiez\b|\bwauquiez\b/i, wiki: "Laurent Wauquiez" },
  { re: /\b[eé]douard\s+philippe\b/i, wiki: "Édouard Philippe" },
  { re: /\bfran[cç]ois\s+bayrou\b|\bbayrou\b/i, wiki: "François Bayrou" },
  { re: /\bya[eë]l\s+braun[- ]?pivet\b|\bbraun[- ]?pivet\b/i, wiki: "Yaël Braun-Pivet" },
  { re: /\b[eé]ric\s+zemmour\b|\bzemmour\b/i, wiki: "Éric Zemmour" },
  { re: /\bmarion\s+mar[eé]chal\b/i, wiki: "Marion Maréchal" },
  { re: /\bmanuel\s+valls\b|\bvalls\b/i, wiki: "Manuel Valls" },
  { re: /\bmichel\s+barnier\b|\bbarnier\b/i, wiki: "Michel Barnier" },
  { re: /\bolivier\s+faure\b/i, wiki: "Olivier Faure" },
  { re: /\brapha[eë]l\s+glucksmann\b|\bglucksmann\b/i, wiki: "Raphaël Glucksmann" },
];

/**
 * Retourne des candidats "Prénom Nom" / "Prénom Le Nom" (Bruno Le Maire).
 */
export function extractPersonCandidates(title: string): string[] {
  const known: string[] = [];
  for (const p of KNOWN_POLITICIANS) {
    if (p.re.test(title)) known.push(p.wiki);
  }

  const normalized = normalizeTitleCasing(title);
  const words = normalized.split(/\s+/).filter(Boolean);
  const out: string[] = [...known];

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

  // Connus d'abord, puis formes les plus longues (Bruno Le Maire avant Bruno Maire)
  const rest = out.filter((x) => !known.includes(x));
  rest.sort((x, y) => y.split(" ").length - x.split(" ").length);

  return [...new Set([...known, ...rest])].slice(0, 6);
}

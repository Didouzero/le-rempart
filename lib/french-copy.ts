/**
 * Nettoyage typo / tics de rédaction communs (flash FB + articles).
 */

const TIC_SENTENCE_RE =
  /\s*(?:On notera(?:\s+(?:ici|également|aussi))?|On observe(?:\s+ici)?|On remarque(?:\s+ici)?|Force est de constater|Il convient de noter|Il est important de (?:noter|souligner)|La méthode est classique)\s*(?:que|:)?\s*/gi;

const TIC_PHRASE_RE =
  /\bla méthode est classique\s*:?\s*/gi;

/** Espace fine / espace avant : ; ! ? (français). Pas avant , . */
export function fixFrenchPunctuation(text: string): string {
  return text
    .replace(/(\S):/g, "$1 :")
    .replace(/(\S);/g, "$1 ;")
    .replace(/(\S)([!?])/g, "$1 $2")
    .replace(/([:;!?])(\S)/g, "$1 $2")
    .replace(/ +([,.])/g, "$1")
    .replace(/ : {2,}/g, " : ")
    .replace(/ {2,}/g, " ")
    .replace(/ *\n {2,}/g, "\n")
    .trim();
}

/** Retire les tics de langage journalistique IA. */
export function stripEditorialTics(text: string): string {
  return text
    .replace(TIC_SENTENCE_RE, " ")
    .replace(TIC_PHRASE_RE, "")
    .replace(/\bon notera (?:ici |que )?/gi, "")
    .replace(/\bon observe (?:ici |que )?/gi, "")
    .replace(/\bon remarque (?:ici |que )?/gi, "")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^ +/gm, "")
    .trim();
}

export function polishFrenchCopy(text: string): string {
  return fixFrenchPunctuation(stripEditorialTics(text));
}

const TITLE_STOP = new Set([
  "dans",
  "pour",
  "avec",
  "sans",
  "sous",
  "chez",
  "vers",
  "apres",
  "avant",
  "selon",
  "entre",
  "contre",
  "depuis",
  "pendant",
  "alors",
  "aussi",
  "encore",
  "tous",
  "tout",
  "toute",
  "toutes",
  "cette",
  "cet",
  "ces",
  "des",
  "les",
  "une",
  "aux",
  "dont",
  "plus",
  "moins",
  "tres",
  "fait",
  "etre",
  "avoir",
  "sont",
  "etait",
  "comme",
  "mais",
  "donc",
  "quand",
  "quoi",
  "quel",
  "quelle",
  "flash",
  "info",
  "rempart",
]);

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9€\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots significatifs du sujet (noms propres, lieux) — pas les peines. */
export function subjectTokens(title: string): string[] {
  return fold(title)
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !TITLE_STOP.has(w) &&
        !/^\d+$/.test(w) &&
        !/^(ans|mois|prison|ferme|sursis|reclusion|cinq|six|sept|huit|neuf|dix)$/.test(
          w,
        ),
    );
}

/**
 * Le flash doit coller au sujet de l'accroche, pas à un autre fil de l'article source.
 */
export function assertFlashOnSubject(title: string, body: string): void {
  const tokens = subjectTokens(title);
  if (tokens.length === 0) return;
  const folded = fold(body);
  const hits = tokens.filter((t) => folded.includes(t));
  const need = Math.min(2, tokens.length);
  if (hits.length < need) {
    throw new Error(
      `flash hors-sujet (accroche : ${tokens.slice(0, 4).join(", ")} ; trouvé : ${hits.join(", ") || "rien"})`,
    );
  }
}

/**
 * Rejette un flash qui NIE explicitement la thèse de l'accroche Canva
 * (ex. titre « endommagée durant le transport » → flash « ce n'est pas un accident »).
 */
export function assertFlashDoesNotNegateThesis(
  title: string,
  body: string,
): void {
  const t = fold(title);
  const b = fold(body);

  if (
    /endommage|abime|casse|detruit|abimee|fissur/.test(t) &&
    /transport|camion|demenagement|transfert|deplace/.test(t)
  ) {
    if (
      /pas (le fruit d |d )?un accident|n est pas .*accident|aucun accident|pas endommage|sans endommage|pas (a |à )?cause du transport|decision n est pas|n etait pas .*transport|pas un probleme de transport/.test(
        b,
      )
    ) {
      throw new Error(
        "flash : contredit l'accroche (nie le dommage / l'accident de transport)",
      );
    }
  }

  if (/\bmacron\b/.test(t) && /decid|decision|ordonne|impose|lui.meme/.test(t)) {
    if (
      /macron n a pas (decid|ordonne|impose)|pas une decision (de |d )?macron|macron n est pour rien/.test(
        b,
      )
    ) {
      throw new Error(
        "flash : contredit l'accroche (nie la décision / le rôle de Macron)",
      );
    }
  }

  // Négation frontale du claim principal (« contrairement à… n'est pas… »)
  if (
    /contrairement (a|à) (ce qu|l accroche|au titre)/.test(b) ||
    /l inverse (est|serait) vrai/.test(b)
  ) {
    throw new Error("flash : contredit l'accroche (négation frontale)");
  }
}

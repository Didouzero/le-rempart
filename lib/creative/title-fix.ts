/**
 * Corrige les tics de titres Canva (apostrophes, accents) avant layout Impact.
 */

const ELISION = new Set(["L", "D", "N", "M", "C", "S", "J", "T", "QU"]);

function foldKey(word: string): string {
  return word
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z']/g, "");
}

/**
 * Formes majuscules sans accents → forme correcte.
 * Clé = NFD sans diacritiques.
 */
const ACCENT_FIXES: Record<string, string> = {
  ARRETE: "ARRÊTÉ",
  ARRETEE: "ARRÊTÉE",
  ARRETES: "ARRÊTÉS",
  ARRETEES: "ARRÊTÉES",
  BLESSE: "BLESSÉ",
  BLESSEE: "BLESSÉE",
  BLESSES: "BLESSÉS",
  BLESSEES: "BLESSÉES",
  TUE: "TUÉ",
  TUEE: "TUÉE",
  TUES: "TUÉS",
  TUEES: "TUÉES",
  EVACUE: "ÉVACUÉ",
  EVACUEE: "ÉVACUÉE",
  EVACUES: "ÉVACUÉS",
  EVACUEES: "ÉVACUÉES",
  DECEDE: "DÉCÉDÉ",
  DECEDEE: "DÉCÉDÉE",
  DECEDES: "DÉCÉDÉS",
  DECEDEES: "DÉCÉDÉES",
  EMEUTE: "ÉMEUTE",
  EMEUTES: "ÉMEUTES",
  EVENEMENT: "ÉVÉNEMENT",
  EVENEMENTS: "ÉVÉNEMENTS",
  SECURITE: "SÉCURITÉ",
  LIBERTE: "LIBERTÉ",
  EGALITE: "ÉGALITÉ",
  ILLEGAL: "ILLÉGAL",
  ILLEGALE: "ILLÉGALE",
  ILLEGAUX: "ILLÉGAUX",
  ILLEGALES: "ILLÉGALES",
  DEJA: "DÉJÀ",
  PRES: "PRÈS",
  APRES: "APRÈS",
  TRES: "TRÈS",
  ETE: "ÉTÉ",
  ETAT: "ÉTAT",
  ELEVE: "ÉLEVÉ",
  ELEVEE: "ÉLEVÉE",
  ELEVES: "ÉLEVÉS",
  ELEVEES: "ÉLEVÉES",
  HOSPITALISE: "HOSPITALISÉ",
  HOSPITALISEE: "HOSPITALISÉE",
  HOSPITALISES: "HOSPITALISÉS",
  HOSPITALISEES: "HOSPITALISÉES",
  CONTROLE: "CONTRÔLE",
  CONTROLES: "CONTRÔLES",
  DEPASSE: "DÉPASSÉ",
  DEPASSEE: "DÉPASSÉE",
  DEPASSES: "DÉPASSÉS",
  DEPASSEES: "DÉPASSÉES",
  INTERPELLE: "INTERPELLÉ",
  INTERPELLEE: "INTERPELLÉE",
  INTERPELLES: "INTERPELLÉS",
  INTERPELLEES: "INTERPELLÉES",
};

/**
 * L AGRESSEUR → L'AGRESSEUR (uniquement si le token est EXACTEMENT L/D/…).
 * Évite le piège JS `\b` avec accents (BLESSÉS DANS ≠ BLESSÉS'DANS).
 */
export function fixElisions(title: string): string {
  const parts = title.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i];
    if (/^\s+$/.test(token)) {
      out.push(token);
      continue;
    }
    const upper = token.toUpperCase();
    // Déjà élidé : L'AGRESSEUR
    if (/^(L|D|N|M|C|S|J|T|QU)'.+/i.test(token)) {
      out.push(upper.replace(/^(L|D|N|M|C|S|J|T|QU)'/i, (m) => m.toUpperCase()));
      continue;
    }
    // Token article seul + mot suivant
    if (ELISION.has(upper)) {
      // saute espaces
      let j = i + 1;
      while (j < parts.length && /^\s+$/.test(parts[j])) j++;
      if (j < parts.length && /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ]/i.test(parts[j])) {
        out.push(`${upper}'${parts[j].toUpperCase()}`);
        i = j;
        continue;
      }
    }
    out.push(token);
  }
  return out.join("");
}

/** INTERPELLE → INTERPELLÉ (participe), sans casser le verbe "la police INTERPELLE". */
export function fixInterpelleParticiple(title: string): string {
  return title
    .replace(
      /\b(ENFIN|ÉTÉ|ETE|EST|FUT|A)\s+INTERPELLE(E|S|ES)?\b/gi,
      (_m, prep, suf) => {
        const s = String(suf || "").toUpperCase();
        const ending =
          s === "E" ? "ÉE" : s === "S" ? "ÉS" : s === "ES" ? "ÉES" : "É";
        return `${String(prep).toUpperCase()} INTERPELL${ending}`;
      },
    )
    .replace(/\bINTERPELLE(E|S|ES)?\s+PAR\b/gi, (_m, suf) => {
      const s = String(suf || "").toUpperCase();
      const ending =
        s === "E" ? "ÉE" : s === "S" ? "ÉS" : s === "ES" ? "ÉES" : "É";
      return `INTERPELL${ending} PAR`;
    });
}

export function fixMissingAccents(title: string): string {
  return title
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token;

      const m = token.match(/^([LDNMCSJT]|QU)'(.+)$/i);
      if (m) {
        const prefix = m[1].toUpperCase();
        const rest = m[2];
        const key = foldKey(rest);
        // Ne pas forcer INTERPELLÉ ici si déjà géré ; accents du radical OK
        const fixed = ACCENT_FIXES[key] || rest.toUpperCase();
        return `${prefix}'${fixed}`;
      }

      const key = foldKey(token);
      if (!key) return token.toUpperCase();

      if (key === "A" && token.replace(/[^A-Za-zÀ-ü]/g, "").length <= 1) {
        return "À";
      }

      // INTERPELLE nu : ne pas toujours forcer (verbe possible) —
      // géré par fixInterpelleParticiple
      if (key.startsWith("INTERPELLE")) {
        return token.toUpperCase();
      }

      return ACCENT_FIXES[key] || token.toUpperCase();
    })
    .join("");
}

/** Pipeline complet avant layout Impact (idempotent). */
export function sanitizeCreativeTitle(title: string): string {
  let t = title
    .replace(/[\u2018\u2019\u02BC\u0060]/g, "'")
    .replace(/['']+/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  // "L' AGRESSEUR" → "L'AGRESSEUR"
  t = t.replace(/\b([LDNMCSJT]|QU)'\s+/gi, "$1'");

  t = fixElisions(t);
  t = fixInterpelleParticiple(t);
  t = fixMissingAccents(t);
  // 2e passe élision au cas où accents ont fragmenté — safe car token-based
  t = fixElisions(t);
  t = fixInterpelleParticiple(t);

  return t.replace(/\s+/g, " ").trim();
}

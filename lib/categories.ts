/**
 * Rubriques Le Rempart — classification auto à la publication.
 */

export const ARTICLE_CATEGORIES = [
  "immigration",
  "justice",
  "economie",
  "politique",
  "insolite",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const CATEGORY_META: Record<
  ArticleCategory,
  { slug: string; label: string; short: string; description: string }
> = {
  immigration: {
    slug: "immigration",
    label: "Immigration",
    short: "Immigration",
    description:
      "Migrants, étrangers, frontières, faits divers liés à l'immigration.",
  },
  justice: {
    slug: "justice",
    label: "Justice",
    short: "Justice",
    description:
      "Tribunaux, peines, enquêtes, police judiciaire et décisions de justice.",
  },
  economie: {
    slug: "economie",
    label: "Économie",
    short: "Économie",
    description:
      "Argent public, fraudes, impôts, escroqueries et gabegie administrative.",
  },
  politique: {
    slug: "politique",
    label: "Politique",
    short: "Politique",
    description:
      "Partis, élections, sondages, candidatures et petite musique politicienne.",
  },
  insolite: {
    slug: "insolite",
    label: "Insolite",
    short: "Insolite",
    description: "Le reste de l'actualité, hors des quatre rubriques principales.",
  },
};

export function isArticleCategory(value: string): value is ArticleCategory {
  return (ARTICLE_CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(category: ArticleCategory | string | null | undefined): string {
  if (category && isArticleCategory(category)) {
    return CATEGORY_META[category].label;
  }
  return CATEGORY_META.insolite.label;
}

export function categoryPath(category: ArticleCategory): string {
  return `/rubriques/${CATEGORY_META[category].slug}`;
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Classification auto à la publication (surchargeable dans l'admin).
 * Priorité : immigration > satire absurde → insolite > justice > politique > économie > insolite
 */
export function classifyArticleCategory(input: {
  title: string;
  excerpt?: string;
  content?: string;
}): ArticleCategory {
  const title = fold(input.title || "");
  const blob = fold(
    [input.title, input.excerpt || "", (input.content || "").slice(0, 1200)].join(
      " ",
    ),
  );

  // 1) Immigration — nationalités / migrants / étrangers en premier
  if (
    /\b(migrant|migrants|immigr|clandestin|sans[- ]papier|etranger|etrangere|etrangers|asile|refugie|refugies|expulsion|reconduite|oqfami|ofii|frontiere|travers[eé]e|naufrae|jungles? de calais|calais|mayotte|tunisien|tunisienne|marocain|marocaine|algerien|algerienne|afghan|afghane|syrien|syrienne|soudanais|erythreen|guineen|malien|senegalais|ivoirien|pakistanais|bangladais|turc\b|turque|kosovar|albanais|rom\b|roma\b|maghrebin|subsaharien|comorien)\b/.test(
      blob,
    ) ||
    /\b(un|une|des|le|la|du)\s+(tunisien|marocain|algerien|afghan|syrien|etranger|migrant)/.test(
      blob,
    )
  ) {
    return "immigration";
  }

  // 1bis) Absurde / déconnexion (incendies, vacances) → insolite, pas « politique »
  const politicalFireOrDisconnect =
    /\b(incendie|incendies|feux? de (foret|brousse)|france brule|gironde)\b/.test(
      blob,
    ) &&
    /\b(ministre|ministere|elysee|macron|deconnect|polemique|vacances|villa|caravane|tour de france|visioconference|sainte[- ]maxime)\b/.test(
      blob,
    );
  const purePoliticalSatire =
    /\b(ministre|presidente de l.assemblee|depute|elysee)\b/.test(title) &&
    /\b(vacances|villa|caravane|tour de france|polemique|deconnect|ras le bol)\b/.test(
      blob,
    );
  if (politicalFireOrDisconnect || purePoliticalSatire) {
    return "insolite";
  }

  // 2) Justice — termes JUDICIAIRES (pas le verbe « juger » / « peiner »)
  if (
    /\b(justice|tribunal|procureur|procureure|audience|condamne|condamnation|requisitoire|prison|incarcer|garde a vue|interpell|arrestation|mis en examen|cour d.assises|comparution|mois de prison|ans de prison|peine de|peines? de prison|relaxe|acquitte|juge d.instruction|parquet|homicide|meurtre|assassinat|viol\b|agression|agresse|poignard|stabbing|coupable)\b/.test(
      blob,
    ) ||
    /\b(le|la|les|du|au)\s+juges?\b/.test(blob)
  ) {
    return "justice";
  }

  // 3) Politique politicienne — avant économie (évite « Attal est une fraude » → économie)
  if (
    /\b(politicien|politicienne|parti\b|partis\b|election|elections|presidentielle|legislatives|municipales|europeennes|sondage|sondages|candidat|candidate|candidature|investiture|primaire|congres du parti|quitte (le|son) parti|rejoint (le|la|les)|rallie|dissidence|motion de censure|assemblee nationale|senat\b|premier ministre|matignon|campagne electorale|bulletin de vote|urnes?\b|scrutin)\b/.test(
      blob,
    ) ||
    /\b(rassemblement national|\brn\b|la france insoumise|\blfi\b|les republicains|\blr\b|renaissance|horizons|modem|parti socialiste|\bnfp\b|nouveau front populaire)\b/.test(
      blob,
    ) ||
    (/\b(macron|attal|bardella|melenchon|le pen|retailleau|darmanin|ciotti|wauquiez|philippe\b|bayrou|glucksmann|rousseau\b|autain|corbieres|panot|braun[- ]?pivet|yael braun|castets|barnier|valls|zemmour|philippot|marion marechal)\b/.test(
      blob,
    ) &&
      /\b(parti|election|sondage|candidat|candidature|investiture|quitte|rejoint|fraude|imposture|rival|rivalite|succession|presidentielle|legislatives|congres|campagne|allege|attaque|vise|en tete|cote)\b/.test(
        blob,
      ))
  ) {
    return "politique";
  }

  // 4) Économie / argent public / fraude financière (pas « fraude » au sens politicien)
  if (
    /\b(economie|economique|escroquerie|escroc|fraude (fiscale|sociale|aux? alloc|a la caf|documentaire)|frauduleux|detourne|detournement|corruption|pot[- ]de[- ]vin|blanchiment|impot|impots|fiscal|contribuable|budget|deficit|subvention|allocs?\b|caf\b|rsa\b|argent public|gabegie|maire.{0,60}(vole|volait|detourn|escroq)|milliards? d.euros|millions? d.euros)\b/.test(
      blob,
    )
  ) {
    return "economie";
  }

  return "insolite";
}

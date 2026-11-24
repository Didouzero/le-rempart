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
  {
    slug: string;
    label: string;
    short: string;
    /** Chapô visible sous le titre et meta description. */
    description: string;
    /** Balise <title> : le sujet et ce qu'on y trouve, la marque est ajoutée par le gabarit. */
    seoTitle: string;
    /** Présentation de la rubrique, en bas de la première page. */
    intro: string[];
  }
> = {
  immigration: {
    slug: "immigration",
    label: "Immigration",
    short: "Immigration",
    seoTitle: "Immigration : actualité, chiffres et enquêtes",
    description:
      "L'immigration est l'un des problèmes majeurs en France. Tenez-vous au courant de l'actualité migratoire française : chiffres, OQTF, asile et frontières.",
    intro: [
      "La rubrique Immigration du Rempart suit au jour le jour l'actualité migratoire française : chiffres officiels des entrées et des titres de séjour, demandes d'asile, obligations de quitter le territoire (OQTF) jamais exécutées, centres d'hébergement et contrôle des frontières.",
      "Nous lisons les rapports de la Cour des comptes, du ministère de l'Intérieur et de l'Ofpra, et nous racontons ce que ces décisions changent concrètement pour les communes et les Français qui les vivent.",
    ],
  },
  justice: {
    slug: "justice",
    label: "Justice",
    short: "Justice",
    seoTitle: "Justice : décisions, procès et peines prononcées",
    description:
      "Découvrez les dernières décisions de justice, les peines prononcées, les procès en cours et les enquêtes judiciaires qui font l'actualité.",
    intro: [
      "La rubrique Justice du Rempart couvre les procès, les condamnations et les décisions des tribunaux qui font l'actualité : violences, trafics, refus d'obtempérer, affaires politico-financières.",
      "Nous donnons les peines réellement prononcées, les antécédents quand ils sont connus et les suites données aux dossiers, pour mesurer l'écart entre la loi votée et la sanction appliquée.",
    ],
  },
  economie: {
    slug: "economie",
    label: "Économie",
    short: "Économie",
    seoTitle: "Économie : argent public, impôts et dépenses de l'État",
    description:
      "Argent public, fraudes, impôts et gabegie administrative : soyez informés en direct sur l'économie française et l'usage de vos impôts.",
    intro: [
      "La rubrique Économie du Rempart suit l'argent des Français : budget de l'État, dette, impôts et taxes, subventions, fraudes sociales et fiscales, gaspillages des administrations et des collectivités.",
      "Chaque article s'appuie sur les chiffres publics, rapports de la Cour des comptes, lois de finances, données de l'Insee, pour montrer qui paie, qui reçoit et ce que cela coûte.",
    ],
  },
  politique: {
    slug: "politique",
    label: "Politique",
    short: "Politique",
    seoTitle: "Politique : actualité, sondages et élections en France",
    description:
      "Sondages électoraux, petite musique politicienne ou candidatures : découvrez en temps réel l'envers du décor de la vie politique française.",
    intro: [
      "La rubrique Politique du Rempart décrypte la vie politique française : gouvernement, Assemblée nationale, partis, sondages, candidatures et campagnes électorales, des municipales à la présidentielle.",
      "Nous rapportons les déclarations, les votes et les patrimoines des élus tels qu'ils sont, et nous rappelons ce qu'ils disaient hier quand cela éclaire ce qu'ils font aujourd'hui.",
    ],
  },
  insolite: {
    slug: "insolite",
    label: "Insolite",
    short: "Insolite",
    seoTitle: "Insolite : faits divers et coulisses de la politique",
    description:
      "Les faits divers, les coulisses et les informations insolites de la politique et des médias se retrouvent ici.",
    intro: [
      "La rubrique Insolite du Rempart rassemble les faits divers, les coulisses des plateaux télé et les épisodes de la vie publique qu'on a du mal à croire : déclarations surprenantes, décisions absurdes, polémiques médiatiques.",
      "Des histoires courtes, vérifiées et racontées avec le sourire, quand l'actualité se charge elle-même de la satire.",
    ],
  },
};

/** Rubrique premium (dossiers Rempart+), hors enum Prisma / fil Telegram. */
export const PREMIUM_CATEGORY = {
  slug: "enquetes",
  label: "Enquête & révélations",
  short: "Enquêtes",
  seoTitle: "Enquêtes exclusives : subventions, fraudes et révélations",
  description:
    "Enquêtes et révélations documentées, chaque mercredi et samedi. Réservé aux abonnés Rempart+.",
  path: "/rubriques/enquetes",
} as const;

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

  const electoralFrame =
    /\b(campagne( electorale| presidentielle)?|presidentielle|legislatives|municipales|europeennes|candidat|candidate|candidature|election|elections|sondage|sondages|investiture|scrutin)\b/.test(
      blob,
    );
  const strongImmigration =
    /\b(migrant|migrants|immigr|clandestin|sans[- ]papier|etranger|etrangere|etrangers|asile|refugie|refugies|expulsion|reconduite|oqfami|ofii|naufrae|jungles? de calais)\b/.test(
      blob,
    ) ||
    /\b(un|une|des|le|la|du)\s+(tunisien|marocain|algerien|afghan|syrien|etranger|migrant)/.test(
      blob,
    );
  const weakImmigration =
    /\b(frontiere|travers[eé]e|calais|mayotte|tunisien|tunisienne|marocain|marocaine|algerien|algerienne|afghan|afghane|syrien|syrienne|soudanais|erythreen|guineen|malien|senegalais|ivoirien|pakistanais|bangladais|turc\b|turque|kosovar|albanais|rom\b|roma\b|maghrebin|subsaharien|comorien)\b/.test(
      blob,
    );

  // 1) Immigration — faits migratoires. Un mot « frontière » dans une campagne
  // électorale (Attal, « chantiers », etc.) ne doit pas voler la rubrique Politique.
  if (strongImmigration || (weakImmigration && !electoralFrame)) {
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

/**
 * Requêtes VISUELLES pour banques d'images (pas le titre journalistique brut).
 */

export function isCrimeOrArrestTopic(title: string): boolean {
  const t = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /interpell|arrestation|police|crs|gendarmerie|arme|arme |fusillade|attentat|terror|agresseur|agress|blesse|attaque|couteau|poignard|stab|tirs?\b|prise d.otage|otage|meurtre|homicide|shooting|tuerie|egorge|desequilibr|allah|akbar|terroriste|assassin/.test(
    t,
  );
}

export function isSceneFirstTopic(title: string): boolean {
  const t = title.toLowerCase();
  return (
    isCrimeOrArrestTopic(title) ||
    /incendie|feu de for[eê]t|feux|brûle|brule|émeute|emeute|casseurs|immigr|migrant|canicule|inondation/.test(
      t,
    )
  );
}

/** Banlist globale : croquis / textures / objets absurdes qui polluent Openverse. */
export const GLOBAL_IMAGE_BAN = [
  "zeppelin",
  "dirigible",
  "airship",
  "ballon",
  "balloon",
  "blimp",
  "cartoon",
  "illustration",
  "drawing",
  "sketch",
  "logo",
  "map",
  "diagram",
  "clipart",
  "vector",
  "engraving",
  "etching",
  "lithograph",
  "postcard",
  // Textures / abstrait (ex. livre / binder passés pour "paris")
  "book",
  "books",
  "binder",
  "notebook",
  "texture",
  "abstract",
  "pattern",
  "fabric",
  "textile",
  "marble",
  "wallpaper",
  "macro",
  "close-up",
  "closeup",
  "still life",
  "still-life",
  "typography",
  "letterpress",
  "paper",
  "pages",
  "spine",
  "leather",
  "bokeh",
  "gradient",
  "background only",
  // Partitions / musique / religion (ex. hymne pour un titre avec « Allah »)
  "sheet music",
  "music score",
  "musical score",
  "hymn",
  "chorale",
  "choral",
  "luther",
  "manuscript",
  "notation",
  "stave",
  "staff paper",
  "feste burg",
  "gott",
  "psalm",
  "gregorian",
  "organ",
  "piano score",
];

const POLICE_MUST = [
  "police",
  "riot",
  "arrest",
  "crs",
  "officer",
  "handcuff",
  "detain",
  "gendarmerie",
  "protest",
  "crowd",
  "street",
];

/** Mots-clés pour scorer/filtrer les hits Openverse vs le sujet. */
export function topicImageKeywords(title: string): {
  must: string[];
  nice: string[];
  ban: string[];
} {
  const t = title.toLowerCase();
  const ban = [...GLOBAL_IMAGE_BAN];

  if (
    /incendie|feu|feux|brûle|brule|gironde|landes|for[eê]t|wildfire|firefighter|flame|burning forest/.test(
      t,
    )
  ) {
    return {
      must: [
        "fire",
        "wildfire",
        "flame",
        "smoke",
        "forest",
        "burn",
        "incendie",
        "feu",
        "pompier",
        "firefighter",
      ],
      nice: ["france", "night", "gironde", "landes"],
      ban,
    };
  }
  if (isCrimeOrArrestTopic(title)) {
    return {
      must: POLICE_MUST,
      nice: ["france", "night", "paris"],
      ban: [
        ...ban,
        "allah",
        "mosque",
        "quran",
        "koran",
        "church",
        "cathedral",
        "bible",
        "jesus",
        "christ",
        "religion",
        "prayer",
        "worship",
      ],
    };
  }
  if (/émeute|emeute|casseurs/.test(t)) {
    return {
      must: ["police", "riot", "arrest", "crs", "protest", "crowd", "street"],
      nice: ["france", "night", "paris"],
      ban,
    };
  }
  if (/immigr|migrant|frontière|frontiere/.test(t)) {
    return {
      must: ["migrant", "border", "refugee", "fence", "camp"],
      nice: ["europe", "france"],
      ban,
    };
  }

  return { must: [], nice: [], ban };
}

/** Toujours rejeter les croquis / textures / dirigeables. */
export function hitIsGloballyBanned(text: string): boolean {
  const hay = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return GLOBAL_IMAGE_BAN.some((b) => hay.includes(b));
}

export function hitMatchesTopic(
  text: string,
  keywords: ReturnType<typeof topicImageKeywords>,
): boolean {
  const hay = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (keywords.ban.some((b) => hay.includes(b))) return false;
  if (keywords.must.length === 0) return true;
  return keywords.must.some((m) => hay.includes(m));
}

/**
 * La visualQuery Kimi n'est crédible que si elle colle au sujet
 * (évite "paris texture book" pour une fusillade).
 */
export function isVisualQueryCredible(query: string, title: string): boolean {
  const q = query.toLowerCase();
  if (!q || q.length < 6) return false;
  if (hitIsGloballyBanned(q)) return false;

  if (
    /incendie|feu|feux|brûle|brule|gironde|landes|for[eê]t/.test(
      title.toLowerCase(),
    )
  ) {
    return /fire|wildfire|flame|smoke|forest|burn|firefighter/.test(q);
  }
  if (isCrimeOrArrestTopic(title)) {
    return /police|arrest|riot|crs|officer|handcuff|detain|gendarme|protest|stab|knife|crime/.test(
      q,
    );
  }
  if (/immigr|migrant|frontière|frontiere/.test(title.toLowerCase())) {
    return /migrant|border|refugee|fence|camp/.test(q);
  }
  // Hors sujet critique : on accepte, sauf banlist
  return !/book|texture|abstract|pattern|fabric|marble|macro/.test(q);
}

export function fallbackVisualQueries(title: string): string[] {
  const t = title.toLowerCase();

  // Faits divers violents : requêtes EN COURTES (Openverse rate les phrases trop longues)
  if (isCrimeOrArrestTopic(title)) {
    return [
      "police arrest",
      "riot police france",
      "police handcuffs",
      "crs police",
      "police officers street",
      "arrest protest police",
    ];
  }
  if (
    /incendie|feu de for[eê]t|feux|brûle|brule|landes|canicule.*feu/.test(t) ||
    (/gironde/.test(t) && /feu|incendie|brûl|brul/.test(t))
  ) {
    return [
      "wildfire forest fire night france",
      "forest fire flames smoke night",
      "firefighter wildfire night europe",
      "burning forest night aerial",
      "france wildfire 2022 landes",
    ];
  }
  if (/émeute|emeute|casseurs|incendie|feu|brûle|brule/.test(t)) {
    return [
      "riots france burning cars night",
      "street fire night france",
      "protesters fire barricade night",
      "burning vehicle night urban",
    ];
  }
  if (/immigr|migrant|clandestin|frontière|frontiere/.test(t)) {
    return [
      "migrants border fence europe night",
      "border patrol europe",
      "refugee camp europe fence",
    ];
  }
  if (/h[oô]pital|clinique|patient|soignant/.test(t)) {
    if (/clim|climatisation|canicule|chaleur|air.?cond/.test(t)) {
      return [
        "hospital patient room",
        "air conditioning unit wall",
        "elderly patient hospital bed",
      ];
    }
    return ["hospital room", "hospital ward", "patient hospital bed"];
  }
  if (/clim|climatisation|canicule|chaleur/.test(t)) {
    return [
      "air conditioning unit",
      "hot weather city street",
      "heatwave urban night",
    ];
  }
  if (/fiscal|impôt|impot|taxe|fraude fiscale/.test(t)) {
    return [
      "french tax office building",
      "euros cash stack",
      "paris ministry finance building",
    ];
  }
  if (/justice|tribunal|procureur|juge/.test(t)) {
    return [
      "french courthouse facade",
      "courtroom empty benches",
      "palais de justice paris",
    ];
  }
  if (/macron|attal|lecornu|ministre|assemblée|elysee|élysée/.test(t)) {
    return [
      title.slice(0, 60),
      "french national assembly hemicycle",
      "elysee palace paris exterior",
    ];
  }

  return [
    "french police street night",
    "paris protest night crowd",
    "france politics demonstration",
  ];
}

export async function suggestVisualSearchQueries(input: {
  title: string;
  excerpt?: string;
}): Promise<string[]> {
  return fallbackVisualQueries(input.title || input.excerpt || "");
}

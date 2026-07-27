/**
 * Requêtes VISUELLES pour banques d'images (pas le titre journalistique brut).
 */

export function isSceneFirstTopic(title: string): boolean {
  const t = title.toLowerCase();
  return /incendie|feu de for[eê]t|feux|brûle|brule|émeute|emeute|casseurs|interpell|arrestation|police|crs|immigr|migrant|canicule|inondation|attentat/.test(
    t,
  );
}

/** Banlist globale : croquis / objets absurdes qui polluent Openverse. */
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
  if (/interpell|arrestation|police|crs|gendarmerie|émeute|emeute/.test(t)) {
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

/** Toujours rejeter les croquis / dirigeables, même hors sujet "incendie". */
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

export function fallbackVisualQueries(title: string): string[] {
  const t = title.toLowerCase();

  if (/interpell|arrestation|police|crs|gendarmerie/.test(t)) {
    return [
      "french riot police night arrest street",
      "police arrest protesters night france",
      "crs police night street france",
      "riot police baton night",
    ];
  }
  if (/incendie|feu de for[eê]t|feux|brûle|brule|landes|canicule.*feu/.test(t) || (/gironde/.test(t) && /feu|incendie|brûl|brul/.test(t))) {
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

/**
 * Requêtes VISUELLES pour banques d'images (Openverse / Unsplash / Wiki).
 * Objectif : scènes spécifiques, chocs, paysage — pas le même stock police/feu en boucle.
 */

import { moonshotChat } from "@/lib/moonshot";

export function isCrimeOrArrestTopic(title: string): boolean {
  const t = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /interpell|arrestation|garde a vue|police|crs|gendarmerie|arme\b|fusillade|attentat|terror|agresseur|agress|attaque|couteau|poignard|stab|tirs?\b|prise d.otage|otage|meurtre|homicide|shooting|tuerie|egorge|desequilibr|allah|akbar|terroriste|assassin/.test(
    t,
  );
}

export function isSceneFirstTopic(title: string): boolean {
  const t = title.toLowerCase();
  return (
    isCrimeOrArrestTopic(title) ||
    /incendie|feu de for[eê]t|feux|brûle|brule|émeute|emeute|casseurs|immigr|migrant|campement|squat|bidonville|rats?|insalubr|canicule|inondation|quartier/.test(
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
  "painting",
  "watercolor",
  "watercolour",
  "artwork",
  "comic",
  "manga",
  "anime",
  "3d render",
  "cgi",
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

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Mots-clés pour scorer/filtrer les hits Openverse vs le sujet. */
export function topicImageKeywords(title: string): {
  must: string[];
  nice: string[];
  ban: string[];
} {
  const t = fold(title);
  const ban = [...GLOBAL_IMAGE_BAN];

  if (/campement|squat|bidonville|rom\b|roma\b|gitan|encampment|slum/.test(t)) {
    return {
      must: [
        "camp",
        "encampment",
        "slum",
        "squat",
        "shanty",
        "tent",
        "trash",
        "garbage",
        "rubbish",
        "debris",
        "makeshift",
      ],
      nice: ["france", "europe", "dirty", "poverty"],
      ban,
    };
  }
  if (/rats?|insalubr|insalubre|sordide|taillis|cafard/.test(t)) {
    return {
      must: [
        "rat",
        "rats",
        "slum",
        "filthy",
        "dirty",
        "garbage",
        "decay",
        "dilapidated",
        "squalor",
        "trash",
      ],
      nice: ["building", "alley", "urban"],
      ban,
    };
  }
  if (
    /quartier|hlm|cite\b|cites\b|barre d.immeuble|banlieue|marseille|seine[- ]saint|93\b/.test(
      t,
    )
  ) {
    return {
      must: [
        "housing",
        "estate",
        "tower",
        "block",
        "suburb",
        "banlieue",
        "building",
        "apartment",
        "concrete",
        "marseille",
      ],
      nice: ["france", "urban", "bleak", "night"],
      ban,
    };
  }
  if (
    /incendie|feu|feux|brule|gironde|landes|foret|wildfire|firefighter|flame|burning forest/.test(
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
  if (
    isCrimeOrArrestTopic(title) &&
    /interpell|arrestation|police|crs|fusillade|attentat/.test(t)
  ) {
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
  if (/emeute|casseurs/.test(t)) {
    return {
      must: ["police", "riot", "arrest", "crs", "protest", "crowd", "street"],
      nice: ["france", "night", "paris"],
      ban,
    };
  }
  if (/immigr|migrant|frontiere|clandestin/.test(t)) {
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
  const hay = fold(text);
  return GLOBAL_IMAGE_BAN.some((b) => hay.includes(b));
}

export function hitMatchesTopic(
  text: string,
  keywords: ReturnType<typeof topicImageKeywords>,
): boolean {
  const hay = fold(text);
  if (keywords.ban.some((b) => hay.includes(b))) return false;
  if (keywords.must.length === 0) return true;
  return keywords.must.some((m) => hay.includes(m));
}

/**
 * La visualQuery Kimi n'est crédible que si elle colle au sujet
 * (évite "paris texture book" pour une fusillade).
 */
export function isVisualQueryCredible(query: string, title: string): boolean {
  const q = fold(query);
  if (!q || q.length < 6) return false;
  if (hitIsGloballyBanned(q)) return false;
  if (/book|texture|abstract|pattern|fabric|marble|macro|cartoon|drawing|sketch|illustration/.test(q)) {
    return false;
  }

  const t = fold(title);
  if (/campement|squat|bidonville|rom\b|gitan/.test(t)) {
    return /camp|encampment|slum|squat|tent|trash|garbage|shanty|makeshift/.test(q);
  }
  if (/incendie|feu|feux|brule|gironde|landes|foret/.test(t)) {
    return /fire|wildfire|flame|smoke|forest|burn|firefighter/.test(q);
  }
  if (
    isCrimeOrArrestTopic(title) &&
    /interpell|arrestation|police|crs|fusillade/.test(t)
  ) {
    return /police|arrest|riot|crs|officer|handcuff|detain|gendarme|protest|stab|knife|crime|housing|estate|slum|building|suburb/.test(
      q,
    );
  }
  if (/immigr|migrant|frontiere/.test(t)) {
    return /migrant|border|refugee|fence|camp/.test(q);
  }
  return true;
}

function placeHints(title: string): string[] {
  const t = fold(title);
  const out: string[] = [];
  if (/marseille/.test(t)) {
    out.push(
      "marseille northern districts housing",
      "marseille bleak apartment blocks",
      "marseille cite buildings concrete",
    );
  }
  if (/antibes/.test(t)) {
    out.push("antibes france urban outskirts", "french riviera commercial zone litter");
  }
  if (/paris/.test(t)) out.push("paris banlieue housing estate");
  if (/lyon/.test(t)) out.push("lyon france urban housing blocks");
  if (/seine[- ]saint|saint[- ]denis|93\b/.test(t)) {
    out.push("seine saint denis housing estate", "banlieue paris tower blocks");
  }
  if (/quartiers? nord/.test(t)) {
    out.push("northern districts social housing france", "bleak french housing project");
  }
  return out;
}

export function fallbackVisualQueries(title: string): string[] {
  const t = fold(title);
  const place = placeHints(title);
  const queries: string[] = [];

  // Campements / squats / insalubrité — AVANT le bucket police générique
  if (/campement|squat|bidonville|rom\b|roma\b|gitan|gens du voyage/.test(t)) {
    queries.push(
      "makeshift camp trash europe",
      "slum encampment garbage france",
      "dirty tent camp litter",
      "shanty town europe rubbish",
      "abandoned lot encampment debris",
      ...place,
    );
  }
  if (/rats?|insalubr|insalubre|appartement insalubre|logement insalubre/.test(t)) {
    queries.push(
      "dilapidated apartment building france",
      "filthy urban alley garbage",
      "squalid housing interior decay",
      "rats garbage urban alley",
      "run down social housing france",
      ...place,
    );
  }
  if (/quartier|hlm|cite\b|barre d.immeuble|banlieue/.test(t) || /marseille/.test(t)) {
    queries.push(
      ...place,
      "french housing project concrete towers",
      "bleak banlieue apartment blocks",
      "dilapidated social housing france",
    );
  }

  if (
    /incendie|feu de foret|feux|brule|landes|canicule.*feu/.test(t) ||
    (/gironde/.test(t) && /feu|incendie|brul/.test(t))
  ) {
    queries.push(
      "wildfire forest fire night france",
      "forest fire flames smoke night",
      "firefighter wildfire night europe",
      "burning forest night aerial",
    );
  } else if (/emeute|casseurs|voiture brule|voitures brulees/.test(t)) {
    queries.push(
      "riots france burning cars night",
      "street fire night france",
      "protesters fire barricade night",
    );
  }

  // Police seulement si l'accroche est vraiment une opération / interpellation
  if (/interpell|arrestation|fusillade|attentat|prise d.otage|crs\b/.test(t)) {
    queries.push(
      "police arrest france street",
      "riot police france night",
      "crs police cordon",
    );
  } else if (isCrimeOrArrestTopic(title) && queries.length === 0) {
    // Faits divers graves : atmosphère du lieu > stock police générique
    queries.push(
      ...place,
      "bleak french housing estate night",
      "dilapidated apartment building europe",
      "dark urban alley france night",
      "run down neighborhood france",
    );
  }

  if (/immigr|migrant|clandestin|frontiere/.test(t)) {
    queries.push(
      "migrants border fence europe",
      "makeshift migrant camp europe",
      "border fence europe night",
    );
  }
  if (/hopital|clinique|patient|soignant/.test(t)) {
    queries.push(
      /clim|climatisation|canicule|chaleur|air.?cond/.test(t)
        ? "hospital patient room heat"
        : "hospital ward france",
      "elderly patient hospital bed",
    );
  }
  if (/clim|climatisation|canicule|chaleur/.test(t)) {
    queries.push("heatwave urban street france", "air conditioning unit wall");
  }
  if (/fiscal|impot|taxe|fraude fiscale/.test(t)) {
    queries.push("french tax office building", "euros cash stack");
  }
  if (/justice|tribunal|procureur|juge|garde a vue/.test(t) && !/insalubr|campement|quartier/.test(t)) {
    queries.push(
      "palais de justice paris facade",
      "french courthouse exterior",
      "police station france exterior",
    );
  }
  if (/macron|attal|bardella|melenchon|ministre|assemblee|elysee/.test(t)) {
    queries.push(
      "french national assembly hemicycle",
      "elysee palace paris exterior",
      "french politics parliament building",
    );
  }

  if (queries.length === 0) {
    queries.push(
      ...place,
      "france urban street documentary photo",
      "french city outskirts bleak",
      "documentary photography france street",
    );
  }

  // Déduplique en gardant l'ordre
  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 6))].slice(
    0,
    10,
  );
}

const VISUAL_QUERY_SYSTEM = `Tu proposes des requêtes de recherche d'images pour la photo d'illustration d'un article de presse français (Le Rempart).
Réponds UNIQUEMENT en JSON : {"queries":["...","..."]}
Règles :
- Exactement 5 requêtes en ANGLAIS, courtes (3 à 7 mots), comme si tu tapais dans Google Images.
- Scènes RÉELLES photographiables, paysage / wide, choc visuel, bonne tension narrative.
- Très SPÉCIFIQUES au titre (lieu, sujet, ambiance). Ex. campement + rats → "makeshift camp trash europe", pas "french police".
- Quartiers pauvres / insalubre / Marseille → immeubles HLM sordides, pas un portrait ni un dessin.
- INTERDIT : cartoon, drawing, illustration, map, abstract, book, texture, logo, clipart.
- INTERDIT de recycler par défaut "french police" / "wildfire" sauf si le titre porte VRAIMENT sur une interpellation ou un incendie.
- Pas de gore explicite (cadavre, pendaison) : privilégier l'atmosphère du lieu.`;

/** Kimi génère des requêtes type Google Images, puis on complète avec les fallbacks. */
export async function suggestVisualSearchQueries(input: {
  title: string;
  excerpt?: string;
}): Promise<string[]> {
  const title = (input.title || "").trim();
  const excerpt = (input.excerpt || "").trim();
  const fallbacks = fallbackVisualQueries(`${title} ${excerpt}`);

  if (!process.env.MOONSHOT_API_KEY || title.length < 8) {
    return fallbacks;
  }

  try {
    const raw = await moonshotChat({
      model: process.env.KIMI_MODEL || "kimi-k3",
      maxTokens: 220,
      timeoutMs: 12_000,
      reasoningEffort: "low",
      messages: [
        { role: "system", content: VISUAL_QUERY_SYSTEM },
        {
          role: "user",
          content: `Titre : ${title.slice(0, 220)}\n${excerpt ? `Chapô : ${excerpt.slice(0, 280)}` : ""}\nDonne 5 requêtes images.`,
        },
      ],
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallbacks;
    const parsed = JSON.parse(match[0]) as { queries?: unknown };
    const fromKimi = (Array.isArray(parsed.queries) ? parsed.queries : [])
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim().slice(0, 80))
      .filter((q) => isVisualQueryCredible(q, title));

    return [...new Set([...fromKimi, ...fallbacks])].slice(0, 12);
  } catch (err) {
    console.error("suggestVisualSearchQueries kimi failed", err);
    return fallbacks;
  }
}

/**
 * Requêtes VISUELLES pour banques d'images (pas le titre journalistique brut).
 * Heuristique rapide — pas d'appel Kimi (évite les hangs Telegram).
 */

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
  if (/macron|attal|ministre|assemblée|elysee|élysée/.test(t)) {
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

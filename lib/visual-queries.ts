/**
 * Requêtes VISUELLES pour banques d'images (pas le titre journalistique brut).
 * Heuristique rapide — pas d'appel Kimi (évite les hangs Telegram).
 */

export function fallbackVisualQueries(title: string): string[] {
  const t = title.toLowerCase();
  const hospital = /h[oô]pital|clinique|patient|soignant/.test(t);
  const clim = /clim|climatisation|canicule|chaleur|air.?cond/.test(t);

  if (hospital && clim) {
    return [
      "hospital patient room",
      "hospital room",
      "air conditioning unit wall",
      "elderly patient hospital bed",
    ];
  }
  if (hospital) {
    return ["hospital room", "hospital ward", "patient hospital bed"];
  }
  if (clim) {
    return [
      "air conditioning unit",
      "air conditioner wall",
      "cooling fan hot weather",
    ];
  }
  if (/macron|attal|ministre|assemblée|élysée/.test(t)) {
    return [title.slice(0, 60)];
  }
  return ["france city street", "french hospital building", "news france"];
}

export async function suggestVisualSearchQueries(input: {
  title: string;
  excerpt?: string;
}): Promise<string[]> {
  return fallbackVisualQueries(input.title || input.excerpt || "");
}

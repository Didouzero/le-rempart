import OpenAI from "openai";
import { getKimiTextModel } from "@/lib/kimi";

/**
 * Génère des requêtes d'image VISUELLES (scène photo), pas le titre de l'actu.
 * Ex. hôpital + clim → "hospital room air conditioning", "elderly patient fan hospital"
 */
export async function suggestVisualSearchQueries(input: {
  title: string;
  excerpt?: string;
}): Promise<string[]> {
  const fallback = fallbackQueries(input.title);
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) return fallback;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.moonshot.ai/v1",
    });
    const completion = await client.chat.completions.create({
      model: getKimiTextModel(),
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `Tu proposes des requêtes pour trouver une PHOTO D'ILLUSTRATION réaliste (banque d'images).
Règles :
- 3 requêtes courtes en ANGLAIS
- Décris une SCÈNE photographiable (lieu, objet, personnes), pas le scoop journalistique
- Exemple pour une actu clim/hôpital : "hospital patient room", "air conditioning unit wall", "elderly person hospital bed"
- Pas de noms de politiques sauf si le sujet EST cette personne
- Réponds UNIQUEMENT un JSON : {"queries":["...","...","..."]}`,
        },
        {
          role: "user",
          content: `Titre : ${input.title}\nChapô : ${input.excerpt || ""}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as { queries?: string[] };
    const queries = (parsed.queries || [])
      .map((q) => String(q).trim())
      .filter((q) => q.length >= 4)
      .slice(0, 4);
    return queries.length ? queries : fallback;
  } catch (err) {
    console.error("visual queries failed", err);
    return fallback;
  }
}

function fallbackQueries(title: string): string[] {
  const t = title.toLowerCase();
  const hospital = /h[oô]pital|clinique|patient|soignant|hôpital/.test(t);
  const clim = /clim|climatisation|canicule|chaleur|air.?cond/.test(t);

  if (hospital && clim) {
    return [
      "hospital room air conditioning",
      "hospital patient room",
      "air conditioning hospital wall",
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
  return ["france street news", "french city street"];
}

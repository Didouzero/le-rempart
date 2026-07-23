import OpenAI from "openai";

/** Modèles dispo sur le compte Moonshot ; surcharge possible via env. */
export function getKimiTextModel(): string {
  return process.env.KIMI_MODEL || "kimi-k2.6";
}

export function getKimiVisionModels(): string[] {
  const primary =
    process.env.KIMI_VISION_MODEL || process.env.KIMI_MODEL || "kimi-k2.6";
  return [...new Set([primary, "kimi-k2.6", "kimi-k3"])];
}

export type GeneratedArticle = {
  title: string;
  excerpt: string;
  content: string;
};

const SYSTEM_PROMPT = `Tu es un rédacteur pour Le Rempart, un site d'actualité français.
Tu écris en français, style presse factuelle, sobre, à la troisième personne.
Pas de sensationnalisme, pas d'emojis, pas de titres clickbait.
Structure l'article en 3 à 6 paragraphes en Markdown (paragraphes séparés par une ligne vide).
Ne mets pas de titre H1 dans le contenu : le titre est fourni séparément.
Réponds UNIQUEMENT avec un JSON valide de la forme :
{"title":"...","excerpt":"...","content":"..."}
L'excerpt fait 1 à 2 phrases.`;

export async function generateArticleFromSource(input: {
  title: string;
  sourceText?: string;
  sourceUrl?: string;
}): Promise<GeneratedArticle> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error("MOONSHOT_API_KEY is not set");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.moonshot.ai/v1",
  });

  const userParts = [
    `Titre proposé : ${input.title}`,
    input.sourceUrl ? `URL source : ${input.sourceUrl}` : null,
    input.sourceText
      ? `Texte source / notes :\n${input.sourceText.slice(0, 12000)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model: getKimiTextModel(),
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `À partir des éléments suivants, rédige un article prêt à publier.\n\n${userParts}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Réponse Kimi vide");
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Réponse Kimi non JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedArticle>;
  if (!parsed.title || !parsed.content || !parsed.excerpt) {
    throw new Error("JSON Kimi incomplet");
  }

  return {
    title: String(parsed.title).trim(),
    excerpt: String(parsed.excerpt).trim(),
    content: String(parsed.content).trim(),
  };
}

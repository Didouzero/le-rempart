import { moonshotChat } from "@/lib/moonshot";

/** Modèles dispo sur le compte Moonshot ; surcharge possible via env. */
export function getKimiTextModel(): string {
  return process.env.KIMI_MODEL || "kimi-k2.6";
}

export function getKimiVisionModels(): string[] {
  const primary =
    process.env.KIMI_VISION_MODEL || process.env.KIMI_MODEL || "kimi-k2.6";
  return [...new Set([primary, "kimi-k2.6"])];
}

export type GeneratedArticle = {
  title: string;
  excerpt: string;
  content: string;
};

const SYSTEM_PROMPT = `Tu es un rédacteur pour Le Rempart, un site d'actualité français.
Tu écris en français, style presse factuelle, sobre, à la troisième personne.
Pas de sensationnalisme, pas d'emojis, pas de titres clickbait.
Structure l'article en 3 à 5 paragraphes en Markdown (paragraphes séparés par une ligne vide).
Ne mets pas de titre H1 dans le contenu : le titre est fourni séparément.
Réponds UNIQUEMENT avec un JSON valide de la forme :
{"title":"...","excerpt":"...","content":"..."}
L'excerpt fait 1 à 2 phrases.`;

function fallbackArticle(title: string, sourceText?: string): GeneratedArticle {
  const clean = title.trim().slice(0, 160) || "Actualité";
  const note = (sourceText || "").trim().slice(0, 400);
  return {
    title: clean,
    excerpt: `${clean}.`,
    content: [
      `Selon les informations relayées par la rédaction, ${clean.charAt(0).toLowerCase()}${clean.slice(1)}.`,
      note
        ? `Éléments communiqués : ${note}`
        : `Les détails de cette actualité sont encore en cours de vérification.`,
      `Le Rempart suivra les éventuelles précisions apportées par les autorités et les acteurs concernés.`,
    ].join("\n\n"),
  };
}

function parseArticleJson(raw: string): GeneratedArticle {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Réponse Kimi non JSON");
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

export async function generateArticleFromSource(input: {
  title: string;
  sourceText?: string;
  sourceUrl?: string;
}): Promise<GeneratedArticle> {
  if (!process.env.MOONSHOT_API_KEY) {
    return fallbackArticle(input.title, input.sourceText);
  }

  const userParts = [
    `Titre proposé : ${input.title}`,
    input.sourceUrl ? `URL source : ${input.sourceUrl}` : null,
    input.sourceText
      ? `Texte source / notes :\n${input.sourceText.slice(0, 4000)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const raw = await moonshotChat({
      model: getKimiTextModel(),
      maxTokens: 1200,
      timeoutMs: 22_000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `À partir des éléments suivants, rédige un article prêt à publier.\n\n${userParts}`,
        },
      ],
    });
    return parseArticleJson(raw);
  } catch (err) {
    console.error("Kimi generate failed, using fallback", err);
    return fallbackArticle(input.title, input.sourceText);
  }
}

import OpenAI from "openai";
import { getKimiTextModel } from "@/lib/kimi";

const PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";

/** 3–4 lignes factuelles pour le post Facebook. */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  articleUrl: string;
}): Promise<string> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  let body = input.excerpt.trim();

  if (apiKey) {
    try {
      const client = new OpenAI({
        apiKey,
        baseURL: "https://api.moonshot.ai/v1",
      });
      const completion = await client.chat.completions.create({
        model: getKimiTextModel(),
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "Tu rédiges un flash info Facebook en français : 3 ou 4 phrases courtes, factuelles, sans emojis dans le corps, sans hashtags. Réponds uniquement avec le texte, rien d'autre.",
          },
          {
            role: "user",
            content: `Titre : ${input.title}\nChapô : ${input.excerpt}\nRésume en 3-4 phrases pour un post Facebook.`,
          },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) body = text.replace(/^["']|["']$/g, "");
    } catch (err) {
      console.error("flash info kimi failed", err);
    }
  }

  return [PREFIX, "", body, "", input.articleUrl].join("\n");
}

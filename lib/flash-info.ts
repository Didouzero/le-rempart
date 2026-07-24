import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";

const PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";

/** 3–4 lignes factuelles pour le post Facebook. */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  articleUrl: string;
}): Promise<string> {
  let body = input.excerpt.trim();

  if (process.env.MOONSHOT_API_KEY) {
    try {
      const text = await moonshotChat({
        model: getKimiTextModel(),
        maxTokens: 280,
        timeoutMs: 12_000,
        reasoningEffort: "low",
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
      if (text) body = text.replace(/^["']|["']$/g, "").trim();
    } catch (err) {
      console.error("flash info kimi failed", err);
    }
  }

  // Un seul espace entre le préfixe et le texte (pas de saut de ligne)
  return `${PREFIX} ${body}\n\n${input.articleUrl}`;
}

import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";

const PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";

/** Force une phrase par ligne. */
function oneSentencePerLine(text: string): string {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return cleaned;
  return parts.join("\n");
}

/**
 * Caption Facebook : FLASH INFO + 3–4 phrases, SANS lien
 * (le lien article va en 1er commentaire pour le reach).
 */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  articleUrl?: string;
}): Promise<string> {
  let body = oneSentencePerLine(input.excerpt);

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
              "Tu rédiges un flash info Facebook en français pour Le Rempart (ton sarcastique / tranchant possible) : exactement 3 ou 4 phrases courtes, factuelles, sans emojis, sans hashtags, sans lien URL. OBLIGATOIRE : une seule phrase par ligne. Pas de tiret long (—). Réponds uniquement avec ces phrases, rien d'autre.",
          },
          {
            role: "user",
            content: `Titre : ${input.title}\nChapô : ${input.excerpt}\nÉcris 3-4 phrases, une par ligne.`,
          },
        ],
      });
      if (text) {
        body = oneSentencePerLine(
          text
            .replace(/^["']|["']$/g, "")
            .replace(/\u2014|\u2013/g, ",")
            .trim(),
        );
      }
    } catch (err) {
      console.error("flash info kimi failed", err);
    }
  }

  return `${PREFIX} ${body}`;
}

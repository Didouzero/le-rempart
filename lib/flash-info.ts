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

function fallbackBody(excerpt: string, title: string): string {
  const fromExcerpt = oneSentencePerLine(excerpt);
  if (fromExcerpt.split("\n").length >= 2) return fromExcerpt;
  const t = title.trim();
  return oneSentencePerLine(
    `${t}. L'affaire illustre encore le décalage entre la parole publique et la réalité. Le Rempart y reviendra.`,
  );
}

/**
 * Caption Facebook : FLASH INFO + 3–4 phrases, SANS lien.
 * Kimi limité à 5s pour ne pas manger le budget avant la vraie publication FB.
 */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  articleUrl?: string;
}): Promise<string> {
  let body = fallbackBody(input.excerpt, input.title);

  if (process.env.MOONSHOT_API_KEY) {
    try {
      const text = await Promise.race([
        moonshotChat({
          model: getKimiTextModel(),
          maxTokens: 280,
          timeoutMs: 5_000,
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
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("flash kimi timeout")), 5_500),
        ),
      ]);
      if (text) {
        body = oneSentencePerLine(
          text
            .replace(/^["']|["']$/g, "")
            .replace(/\u2014|\u2013/g, ",")
            .trim(),
        );
      }
    } catch (err) {
      console.error("flash info kimi skipped", err);
    }
  }

  return `${PREFIX} ${body}`;
}

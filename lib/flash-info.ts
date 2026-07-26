import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";

/** Une seule phrase courte, ton Rempart, pour le post Facebook. */
function fallbackPunchline(title: string, excerpt: string): string {
  const src = `${excerpt} ${title}`.trim();
  if (/honte|scandale|indigne/i.test(src)) return "C'est vraiment la honte…";
  if (/€|euro|retraite|impôt|subvention/i.test(src))
    return "Et après on parle de serrer la ceinture…";
  if (/immigration|délinquan|violence|cité/i.test(src))
    return "On marche sur la tête.";
  return "On n'invente rien…";
}

function cleanPunchline(raw: string): string {
  return raw
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/^‼️\s*/u, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Caption Facebook SANS lien (le lien va en 1er commentaire pour le reach).
 * Format : ‼️🇫🇷 FLASH INFO — + micro-commentaire
 */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  articleUrl?: string;
}): Promise<string> {
  let punch = fallbackPunchline(input.title, input.excerpt);

  if (process.env.MOONSHOT_API_KEY) {
    try {
      const text = await moonshotChat({
        model: getKimiTextModel(),
        maxTokens: 60,
        timeoutMs: 10_000,
        reasoningEffort: "low",
        messages: [
          {
            role: "system",
            content:
              "Tu écris UNE seule micro-réaction Facebook en français pour Le Rempart (média de droite radicale, ton sarcastique / aigri). Maximum 12 mots. Pas d'emoji, pas de hashtag, pas de lien, pas de guillemets. Exemples de ton : « C'est vraiment la honte… » / « On marche sur la tête. » / « Deux poids, deux mesures. » Réponds uniquement avec cette phrase.",
          },
          {
            role: "user",
            content: `Titre : ${input.title}\nChapô : ${input.excerpt}`,
          },
        ],
      });
      const cleaned = cleanPunchline(text || "");
      if (cleaned.length >= 8) punch = cleaned;
    } catch (err) {
      console.error("flash punchline kimi failed", err);
    }
  }

  return `‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 — ${punch}`;
}

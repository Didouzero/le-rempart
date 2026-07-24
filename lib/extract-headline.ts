import { moonshotChat, type MoonshotMessage } from "@/lib/moonshot";
import { getKimiVisionModels } from "@/lib/kimi";

/**
 * Lit le titre / accroche écrite sur la créative Canva (vision Kimi).
 */
export async function extractHeadlineFromCreative(input: {
  buffer: Buffer;
  mime: string;
}): Promise<string> {
  if (!process.env.MOONSHOT_API_KEY) {
    throw new Error("MOONSHOT_API_KEY is not set");
  }

  const mime = input.mime.startsWith("image/")
    ? input.mime
    : "image/jpeg";
  const dataUrl = `data:${mime};base64,${input.buffer.toString("base64")}`;

  const models = getKimiVisionModels();
  let lastError: unknown;

  for (const model of models) {
    try {
      const messages: MoonshotMessage[] = [
        {
          role: "system",
          content:
            "Tu extrais le titre principal d'une créative d'actualité (image Canva). Réponds UNIQUEMENT avec le texte du titre, sans guillemets, sans commentaire.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: "Quel est le titre / accroche principale écrite sur cette image ?",
            },
          ],
        },
      ];

      const raw = await moonshotChat({
        model,
        maxTokens: 200,
        timeoutMs: 28_000,
        messages,
      });

      const title = raw
        .replace(/^["«»]|["«»]$/g, "")
        .replace(/^titre\s*[:\-–]\s*/i, "")
        .trim();

      if (title.length >= 8) return title.slice(0, 200);
      throw new Error("Titre extrait trop court");
    } catch (err) {
      lastError = err;
      console.error(`vision extract failed with ${model}`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Impossible de lire le titre sur la créative");
}

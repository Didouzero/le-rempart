import OpenAI from "openai";

/**
 * Lit le titre / accroche écrite sur la créative Canva (vision Kimi).
 */
export async function extractHeadlineFromCreative(input: {
  buffer: Buffer;
  mime: string;
}): Promise<string> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error("MOONSHOT_API_KEY is not set");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.moonshot.ai/v1",
  });

  const mime = input.mime || "image/png";
  const b64 = input.buffer.toString("base64");
  const dataUrl = `data:${mime};base64,${b64}`;

  const models = [
    process.env.KIMI_VISION_MODEL,
    "kimi-k2.7",
    "kimi-k3",
  ].filter(Boolean) as string[];

  let lastError: unknown;
  for (const model of models) {
    try {
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 256,
        messages: [
          {
            role: "system",
            content:
              "Tu extrais le titre principal d'une créative d'actualité (image Canva). Réponds UNIQUEMENT avec le texte du titre, sans guillemets, sans commentaire.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: "Quel est le titre / accroche principale écrite sur cette image ?",
              },
            ],
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() || "";
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

import sharp from "sharp";
import { moonshotChat, type MoonshotMessage } from "@/lib/moonshot";

/** k2.6 thinking-off sur un JPEG léger : quelques secondes, pas 28. */
const VISION_MODEL = "kimi-k2.6";
const VISION_TIMEOUT_MS = 12_000;
const VISION_MAX_EDGE = 960;

async function jpegForVision(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^["«»]|["«»]$/g, "")
    .replace(/^titre\s*[:\-–]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lit le titre / accroche écrite sur la créative Canva.
 * Image d’abord réduite : un PNG 4 Mo faisait timeout, un JPEG 960px passe.
 */
export async function extractHeadlineFromCreative(input: {
  buffer: Buffer;
  mime: string;
}): Promise<string> {
  if (!process.env.MOONSHOT_API_KEY) {
    throw new Error("MOONSHOT_API_KEY is not set");
  }

  const jpeg = await jpegForVision(input.buffer);
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

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
    model: VISION_MODEL,
    maxTokens: 80,
    timeoutMs: VISION_TIMEOUT_MS,
    messages,
  });

  const title = cleanTitle(raw);
  if (title.length >= 6) return title.slice(0, 200);
  throw new Error("Titre extrait trop court");
}

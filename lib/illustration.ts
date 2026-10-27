import sharp from "sharp";

// 2048 px de côté : même une image portrait garde plus de 1 200 px de large (Google Discover).
const MAX_EDGE = 2048;
/** Largeur minimale demandée par Google Discover pour les grandes vignettes. */
export const DISCOVER_MIN_WIDTH = 1200;
const MAX_BYTES = 3_500_000;

function sniffMime(buffer: Buffer, declared?: string): string {
  if (
    declared &&
    declared.startsWith("image/") &&
    declared !== "application/octet-stream"
  ) {
    return declared;
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF") {
    return "image/webp";
  }
  return "image/jpeg";
}

/** Largeur qu'aura l'illustration une fois préparée pour le site (0 si illisible). */
export async function preparedIllustrationWidth(buffer: Buffer): Promise<number> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    const rotated = (meta.orientation ?? 1) >= 5;
    const w = (rotated ? meta.height : meta.width) ?? 0;
    const h = (rotated ? meta.width : meta.height) ?? 0;
    return Math.round(w * Math.min(1, MAX_EDGE / Math.max(w, h, 1)));
  } catch {
    return 0;
  }
}

/** Télécharge une image distante pour l'héberger sur le site (plus de lien vers un autre serveur). */
export async function downloadIllustration(
  url: string,
): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LeRempartBot/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`image introuvable (HTTP ${res.status})`);
  const mime = res.headers.get("content-type") || "";
  if (!mime.startsWith("image/")) throw new Error("ce lien n'est pas une image");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 15_000_000) throw new Error("image trop lourde (max 15 Mo)");
  return { buffer, mime };
}

/** Réduit une illustration Telegram pour le site (JPEG, 2048 px de côté au plus). */
export async function prepareSiteIllustration(input: {
  buffer: Buffer;
  mime?: string;
}): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const jpeg = await sharp(input.buffer, { failOn: "none" })
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    if (jpeg.length > MAX_BYTES) {
      throw new Error("Illustration trop lourde même compressée (max ~3,5 Mo).");
    }
    return { buffer: jpeg, mime: "image/jpeg" };
  } catch (err) {
    if (err instanceof Error && /trop lourde/.test(err.message)) throw err;
    if (input.buffer.length > MAX_BYTES) {
      throw new Error("Illustration trop lourde (max ~3,5 Mo).");
    }
    return {
      buffer: input.buffer,
      mime: sniffMime(input.buffer, input.mime),
    };
  }
}

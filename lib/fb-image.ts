import sharp from "sharp";

/** Au-delà, on compresse (vraiment gros fichiers / hors format créative). */
const PASS_THROUGH_MAX_BYTES = 4_000_000;
const COMPRESS_MAX_EDGE = 2048;

/**
 * Prépare la créative pour Facebook.
 * Les PNG/JPG typiques (1080×1440, 2–3 Mo) partent tels quels.
 * On ne recompresse que les fichiers trop lourds ou trop grands.
 */
export async function prepareFacebookImage(input: {
  buffer: Buffer;
  mime: string;
}): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const meta = await sharp(input.buffer, { failOn: "none" }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const maxEdge = Math.max(width, height);
    const mime = (input.mime || "").toLowerCase();
    const isRaster =
      mime.includes("png") ||
      mime.includes("jpeg") ||
      mime.includes("jpg") ||
      mime.includes("webp") ||
      meta.format === "png" ||
      meta.format === "jpeg" ||
      meta.format === "webp";

    const smallEnough = input.buffer.length <= PASS_THROUGH_MAX_BYTES;
    const sizeOk = maxEdge > 0 && maxEdge <= COMPRESS_MAX_EDGE;

    if (isRaster && smallEnough && sizeOk) {
      return {
        buffer: input.buffer,
        mime:
          mime.startsWith("image/")
            ? input.mime
            : meta.format === "png"
              ? "image/png"
              : meta.format === "webp"
                ? "image/webp"
                : "image/jpeg",
      };
    }

    const buffer = await sharp(input.buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: COMPRESS_MAX_EDGE,
        height: COMPRESS_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    return { buffer, mime: "image/jpeg" };
  } catch (err) {
    console.error("prepareFacebookImage failed, using original", err);
    return input;
  }
}

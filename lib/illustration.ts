import sharp from "sharp";

const MAX_EDGE = 1600;
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

/** Réduit une illustration Telegram pour le site (JPEG 1600px). */
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

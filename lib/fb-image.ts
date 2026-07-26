import sharp from "sharp";

/**
 * Compresse / redimensionne la créative pour l'upload Facebook
 * (évite les hangs sur PNG Canva de plusieurs Mo).
 */
export async function prepareFacebookImage(input: {
  buffer: Buffer;
  mime: string;
}): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const buffer = await sharp(input.buffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { buffer, mime: "image/jpeg" };
  } catch (err) {
    console.error("prepareFacebookImage failed, using original", err);
    return input;
  }
}

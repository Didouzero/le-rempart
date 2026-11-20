import sharp from "sharp";

const W = 1080;
const H = 1920;

/**
 * Story 9:16 : Instagram recadre toute image plus large que 9:16 pour remplir l'écran,
 * ce qui coupe le texte de la créative (3:4). On pose donc la créative entière au centre,
 * sur un fond fait de la même créative agrandie, floutée et assombrie.
 */
export async function prepareStoryImage(image: {
  buffer: Buffer;
  mime: string;
}): Promise<{ buffer: Buffer; mime: string }> {
  const background = await sharp(image.buffer)
    .resize(W, H, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.45 })
    .toBuffer();
  const foreground = await sharp(image.buffer)
    .resize(W, H, { fit: "inside" })
    .toBuffer();
  const buffer = await sharp(background)
    .composite([{ input: foreground, gravity: "center" }])
    .jpeg({ quality: 90 })
    .toBuffer();
  return { buffer, mime: "image/jpeg" };
}

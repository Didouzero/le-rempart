import { NextResponse } from "next/server";
import sharp from "sharp";
import { ILLUSTRATION_WIDTHS } from "@/lib/cover-image";
import { getDossierCover } from "@/lib/investigation-draft";
import { prisma, withDbTimeout } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

// Cache CDN Vercel : sans s-maxage, chaque vue relit l'image entière en base.
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

function sniffMime(buf: Buffer, declared: string | null): string {
  if (declared && declared.startsWith("image/") && !declared.includes("octet-stream")) {
    return declared;
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF") {
    return "image/webp";
  }
  return "image/jpeg";
}

/**
 * Illustration hébergée. Sans paramètre : fichier original (og:image, Google, Facebook).
 * Avec ?w=480|800|1200|1600 : copie WebP redimensionnée pour l'affichage sur le site.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const width = Number(new URL(request.url).searchParams.get("w"));
  const resize = (ILLUSTRATION_WIDTHS as readonly number[]).includes(width);

  try {
    const article = await withDbTimeout(
      prisma.article.findUnique({
        where: { id },
        select: { illustrationData: true, illustrationMime: true },
      }),
    );

    // Sans article à cet identifiant, c'est peut-être l'illustration d'une enquête.
    const dossier = article?.illustrationData ? null : await withDbTimeout(getDossierCover(id));
    if (!article?.illustrationData && !dossier) {
      return new NextResponse("Not found", { status: 404 });
    }

    const buffer = dossier?.buffer ?? Buffer.from(article!.illustrationData!);

    if (resize) {
      try {
        const webp = await sharp(buffer, { failOn: "none" })
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 74 })
          .toBuffer();
        return new NextResponse(new Uint8Array(webp), {
          status: 200,
          headers: { "Content-Type": "image/webp", "Cache-Control": CACHE_CONTROL },
        });
      } catch (err) {
        console.error("illustration resize", err);
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": sniffMime(buffer, dossier?.mime ?? article?.illustrationMime ?? null),
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}

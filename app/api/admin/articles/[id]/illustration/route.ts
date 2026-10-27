import { NextResponse } from "next/server";
import {
  downloadIllustration,
  prepareSiteIllustration,
  preparedIllustrationWidth,
} from "@/lib/illustration";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { utf8TextOrNull } from "@/lib/utf8";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST (multipart) — illustration du site depuis l'admin : un fichier, ou un lien
 * téléchargé puis hébergé sur le site (jamais chargé depuis un autre serveur),
 * et/ou la légende seule.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("file");
  const url = String(form.get("url") || "").trim();
  const caption = utf8TextOrNull(String(form.get("caption") || "").trim() || null, 400);

  try {
    let image: { buffer: Buffer; mime: string } | null = null;
    if (file instanceof File && file.size > 0) {
      image = { buffer: Buffer.from(await file.arrayBuffer()), mime: file.type };
    } else if (/^https?:\/\//i.test(url) && !url.includes("/api/media/")) {
      image = await downloadIllustration(url);
    }

    if (!image) {
      const updated = await prisma.article.update({
        where: { id },
        data: { coverCaption: caption },
        select: { coverImageUrl: true, coverCaption: true },
      });
      return NextResponse.json({ ...updated, width: null });
    }

    const width = await preparedIllustrationWidth(image.buffer);
    const prepared = await prepareSiteIllustration(image);
    const updated = await prisma.article.update({
      where: { id },
      data: {
        illustrationData: Buffer.from(prepared.buffer),
        illustrationMime: prepared.mime,
        // Paramètre de version : le navigateur et le cache rechargent la nouvelle image.
        coverImageUrl: `${absoluteUrl(`/api/media/${id}/illustration`)}?v=${Date.now()}`,
        coverCaption: caption,
      },
      select: { coverImageUrl: true, coverCaption: true },
    });
    return NextResponse.json({ ...updated, width });
  } catch (err) {
    console.error("admin illustration", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Illustration impossible" },
      { status: 400 },
    );
  }
}

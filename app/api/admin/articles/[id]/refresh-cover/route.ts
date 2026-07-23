import { NextResponse } from "next/server";
import { resolveRelevantCoverUrl } from "@/lib/openverse";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST — régénère l'illustration web (pas la créative Canva). */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, title: true, excerpt: true },
    });
    if (!article) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }

    const coverImageUrl = await resolveRelevantCoverUrl({
      title: article.title,
      excerpt: article.excerpt,
    });

    if (!coverImageUrl) {
      return NextResponse.json(
        { error: "Aucune illustration trouvée" },
        { status: 404 },
      );
    }

    const updated = await prisma.article.update({
      where: { id },
      data: { coverImageUrl },
      select: { id: true, slug: true, coverImageUrl: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Régénération illustration impossible" },
      { status: 500 },
    );
  }
}

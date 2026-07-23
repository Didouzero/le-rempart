import { NextResponse } from "next/server";
import { ArticleStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

type Params = { params: Promise<{ id: string }> };

const articleSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  sourceText: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]),
});

async function makeUniqueSlug(title: string, excludeId: string) {
  const base = slugify(title);
  let candidate = base;
  let i = 2;

  while (true) {
    const existing = await prisma.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }

    const parsed = articleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const data = parsed.data;
    const status = data.status as ArticleStatus;
    const slug =
      existing.title === data.title.trim()
        ? existing.slug
        : await makeUniqueSlug(data.title, id);

    const article = await prisma.article.update({
      where: { id },
      data: {
        title: data.title.trim(),
        excerpt: data.excerpt.trim(),
        content: data.content.trim(),
        sourceText: data.sourceText?.trim() || null,
        sourceUrl: data.sourceUrl?.trim() || null,
        slug,
        status,
        publishedAt:
          status === "published"
            ? existing.publishedAt ?? new Date()
            : existing.publishedAt,
      },
    });

    return NextResponse.json(article);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  }
}

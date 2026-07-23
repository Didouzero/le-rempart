import { NextResponse } from "next/server";
import { ArticleStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const articleSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  sourceText: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]),
});

async function makeUniqueSlug(title: string, excludeId?: string) {
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

export async function POST(request: Request) {
  try {
    const parsed = articleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const data = parsed.data;
    const slug = await makeUniqueSlug(data.title);
    const status = data.status as ArticleStatus;

    const article = await prisma.article.create({
      data: {
        title: data.title.trim(),
        excerpt: data.excerpt.trim(),
        content: data.content.trim(),
        sourceText: data.sourceText?.trim() || null,
        sourceUrl: data.sourceUrl?.trim() || null,
        slug,
        status,
        publishedAt: status === "published" ? new Date() : null,
      },
    });

    return NextResponse.json(article);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Création impossible" }, { status: 500 });
  }
}

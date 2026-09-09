import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  coverImageUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional(),
  membersOnly: z.boolean().optional(),
  published: z.boolean().optional(),
});

async function uniqueSlug(title: string, excludeId: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let i = 2;
  while (true) {
    const existing = await prisma.specialDossier.findUnique({
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
    const existing = await prisma.specialDossier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const data = parsed.data;
    const slug =
      existing.title === data.title.trim()
        ? existing.slug
        : await uniqueSlug(data.title, id);

    const published =
      data.published === undefined
        ? Boolean(existing.publishedAt)
        : data.published;

    const dossier = await prisma.specialDossier.update({
      where: { id },
      data: {
        title: data.title.trim(),
        excerpt: data.excerpt.trim(),
        content: data.content.trim(),
        slug,
        membersOnly: data.membersOnly ?? existing.membersOnly,
        ...(data.coverImageUrl !== undefined
          ? {
              coverImageUrl:
                typeof data.coverImageUrl === "string" && data.coverImageUrl.trim()
                  ? data.coverImageUrl.trim()
                  : null,
            }
          : {}),
        publishedAt: published
          ? existing.publishedAt ?? new Date()
          : null,
      },
    });

    return NextResponse.json(dossier);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Mise à jour impossible" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.specialDossier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Suppression impossible" },
      { status: 500 },
    );
  }
}

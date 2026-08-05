import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import { classifyArticleCategory } from "@/lib/categories";
import { generateArticlePipeline } from "@/lib/kimi";
import { dossierForPersistence } from "@/lib/research/persist";
import type { Prisma } from "@prisma/client";
import { resolveRelevantCoverUrl } from "@/lib/openverse";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { withTimeout } from "@/lib/with-timeout";
import { createHash } from "crypto";

async function makeUniqueSlug(title: string) {
  const base = slugify(title);
  let candidate = base;
  let i = 2;
  while (true) {
    const existing = await prisma.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

export function siteUrl(): string {
  return siteUrlBase();
}

function detectImageMime(buffer: Buffer, declared?: string): string {
  if (
    declared &&
    declared.startsWith("image/") &&
    declared !== "application/octet-stream"
  ) {
    return declared;
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
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
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

export async function publishArticleFromCreative(input: {
  caption?: string;
  /** Entrée principale Knowledge Builder (veille / admin). */
  sourceUrl?: string;
  sourceTitle?: string;
  headline?: string;
  image?: { buffer: Buffer; mime: string };
  notify?: (text: string) => Promise<void>;
}): Promise<{
  id: string;
  publicId: number;
  slug: string;
  title: string;
  excerpt: string;
  url: string;
  coverImageUrl: string | null;
  creative?: { buffer: Buffer; mime: string };
}> {
  const caption = input.caption?.trim() || "Actualité du jour";
  const sourceUrl = input.sourceUrl?.trim() || undefined;
  const notify = input.notify || (async () => {});
  // Sujet documentaire : titre source > headline > caption (dernier recours).
  const researchTitle = (
    input.sourceTitle?.trim() ||
    input.headline?.trim() ||
    caption
  ).slice(0, 200);

  const recent = await prisma.article.findFirst({
    where: {
      OR: [
        sourceUrl ? { sourceUrl } : undefined,
        { sourceText: caption },
      ].filter(Boolean) as Array<{ sourceUrl?: string; sourceText?: string }>,
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return {
      id: recent.id,
      publicId: recent.publicId,
      slug: recent.slug,
      title: recent.title,
      excerpt: recent.excerpt,
      url: articlePublicUrl(recent.publicId, siteUrl()),
      coverImageUrl: recent.coverImageUrl,
      creative: input.image
        ? {
            buffer: input.image.buffer,
            mime: detectImageMime(input.image.buffer, input.image.mime),
          }
        : undefined,
    };
  }

  // Anti double-envoi Telegram pendant qu'une génération tourne (~8 min).
  const lockKey = `publish:lock:${createHash("sha1")
    .update(researchTitle.toLowerCase())
    .digest("hex")
    .slice(0, 16)}`;
  const lockExisting = await prisma.appSetting.findUnique({
    where: { key: lockKey },
  });
  if (lockExisting) {
    const started = Number(lockExisting.value) || 0;
    if (Date.now() - started < 8 * 60 * 1000) {
      throw new Error(
        "Publication déjà en cours pour ce titre (renvoi Telegram ignoré).",
      );
    }
  }
  await prisma.appSetting.upsert({
    where: { key: lockKey },
    create: { key: lockKey, value: String(Date.now()) },
    update: { value: String(Date.now()) },
  });

  let generated: {
    title: string;
    excerpt: string;
    content: string;
  };
  let pipelineDossier: Awaited<
    ReturnType<typeof generateArticlePipeline>
  >["dossier"] = null;

  try {
    // Budget serré pour rester sous maxDuration Vercel (300s) + FB après.
    const pipeline = await generateArticlePipeline(
      {
        title: researchTitle,
        sourceUrl,
        caption,
      },
      {
        fast: true,
        maxResearchPasses: 1,
        researchTimeoutMs: 140_000,
        writingTimeoutMs: 75_000,
        onProgress: (msg) => notify(msg),
      },
    );
    pipelineDossier = pipeline.dossier;
    const article = pipeline.artifacts.article;
    if (!article) {
      throw new Error("Pipeline éditorial : aucun article produit");
    }
    generated = article;
  } finally {
    await prisma.appSetting.delete({ where: { key: lockKey } }).catch(() => {});
  }

  await notify("Recherche d'illustration site…");
  const coverImageUrl = await withTimeout(
    resolveRelevantCoverUrl({
      title: generated.title || researchTitle,
      excerpt: generated.excerpt || caption,
    }),
    28_000,
    "Timeout illustration",
  ).catch((err) => {
    console.error(err);
    return null;
  });

  const slug = await makeUniqueSlug(generated.title);
  const creativeMime = input.image
    ? detectImageMime(input.image.buffer, input.image.mime)
    : null;

  // Stocker la créative (jusqu'à ~4 Mo) pour /api/media + FB URL fallback
  const storeBlob =
    input.image &&
    input.image.buffer.length > 0 &&
    input.image.buffer.length < 4_000_000;

  const category = classifyArticleCategory({
    title: generated.title,
    excerpt: generated.excerpt,
    content: generated.content,
  });

  const article = await prisma.article.create({
    data: {
      title: generated.title,
      excerpt: generated.excerpt,
      content: generated.content,
      sourceText: caption,
      sourceUrl: sourceUrl || null,
      researchDossier: pipelineDossier
        ? (dossierForPersistence(
            pipelineDossier,
          ) as unknown as Prisma.InputJsonValue)
        : undefined,
      slug,
      category,
      status: "published",
      publishedAt: new Date(),
      coverImageUrl,
      coverImageMime: storeBlob ? creativeMime : null,
      coverImageData: storeBlob ? new Uint8Array(input.image!.buffer) : null,
    },
  });

  return {
    id: article.id,
    publicId: article.publicId,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    url: articlePublicUrl(article.publicId, siteUrl()),
    coverImageUrl: article.coverImageUrl,
    creative: input.image
      ? { buffer: input.image.buffer, mime: creativeMime || "image/jpeg" }
      : undefined,
  };
}

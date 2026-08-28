import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import { classifyArticleCategory } from "@/lib/categories";
import { fetchSourceText } from "@/lib/fetch-source";
import { resolveRelevantCoverUrl } from "@/lib/openverse";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { withTimeout } from "@/lib/with-timeout";
import { titleFromCreative, writeArticleSimple } from "@/lib/write-simple";
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
  sourceUrl?: string;
  sourceTitle?: string;
  headline?: string;
  /** URL illustration fournie par l'utilisateur (prioritaire). */
  coverImageUrl?: string;
  image?: { buffer: Buffer; mime: string };
  notify?: (text: string) => Promise<void>;
  requireSource?: boolean;
}): Promise<{
  id: string;
  publicId: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  sourceText: string | null;
  sourceUrl: string | null;
  url: string;
  coverImageUrl: string | null;
  creative?: { buffer: Buffer; mime: string };
}> {
  const caption = input.caption?.trim() || "Actualité du jour";
  const sourceUrl = input.sourceUrl?.trim() || undefined;
  const notify = input.notify || (async () => {});
  const requireSource = input.requireSource ?? Boolean(sourceUrl);

  const creativeTitle = (
    input.headline?.trim() ||
    input.sourceTitle?.trim() ||
    caption
  ).slice(0, 500);

  if (requireSource && !sourceUrl) {
    throw new Error(
      "Lien source obligatoire. Envoie l’URL de l’article de référence.",
    );
  }

  let scrapedText: string | undefined;
  if (sourceUrl) {
    await notify("Lecture de la page source…");
    try {
      scrapedText = await fetchSourceText(sourceUrl);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "échec scrape";
      throw new Error(
        `Impossible de lire le lien source (${reason}). Renvoie une autre URL, ou vérifie que la page n’est pas derrière un paywall / anti-bot.`,
      );
    }
    if ((scrapedText?.trim().length || 0) < 80) {
      throw new Error(
        "La page source ne contient presque pas de texte exploitable. Renvoie une autre URL.",
      );
    }
  }

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
      content: recent.content,
      sourceText: recent.sourceText,
      sourceUrl: recent.sourceUrl,
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

  const lockKey = `publish:lock:${createHash("sha1")
    .update((sourceUrl || creativeTitle).toLowerCase())
    .digest("hex")
    .slice(0, 16)}`;
  const lockExisting = await prisma.appSetting.findUnique({
    where: { key: lockKey },
  });
  if (lockExisting) {
    const started = Number(lockExisting.value) || 0;
    if (Date.now() - started < 8 * 60 * 1000) {
      throw new Error(
        "Publication déjà en cours pour cette source (renvoi Telegram ignoré).",
      );
    }
  }
  await prisma.appSetting.upsert({
    where: { key: lockKey },
    create: { key: lockKey, value: String(Date.now()) },
    update: { value: String(Date.now()) },
  });

  let generated: { title: string; excerpt: string; content: string };

  try {
    if (!sourceUrl || !scrapedText) {
      throw new Error(
        "Publication manuelle : lien source + texte scrapé requis.",
      );
    }

    generated = await writeArticleSimple({
      creativeTitle,
      sourceUrl,
      sourceText: scrapedText,
      onProgress: (msg) => notify(msg),
    });
    // Sécurité : titre = créative, jamais la sortie modèle
    generated.title = titleFromCreative(creativeTitle);
  } finally {
    await prisma.appSetting.delete({ where: { key: lockKey } }).catch(() => {});
  }

  await notify(
    input.coverImageUrl?.trim()
      ? "Illustration : URL fournie."
      : "Recherche d'illustration site…",
  );
  const providedCover = input.coverImageUrl?.trim() || "";
  const coverImageUrl = providedCover
    ? providedCover
    : await withTimeout(
        resolveRelevantCoverUrl({
          title: generated.title,
          excerpt: generated.excerpt,
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
      sourceText: scrapedText?.slice(0, 12000) || caption,
      sourceUrl: sourceUrl || null,
      researchDossier: undefined,
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
    content: article.content,
    sourceText: article.sourceText,
    sourceUrl: article.sourceUrl,
    url: articlePublicUrl(article.publicId, siteUrl()),
    coverImageUrl: article.coverImageUrl,
    creative: input.image
      ? { buffer: input.image.buffer, mime: creativeMime || "image/jpeg" }
      : undefined,
  };
}

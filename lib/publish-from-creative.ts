import { prisma } from "@/lib/prisma";
import { generateArticleFromSource } from "@/lib/kimi";
import { resolveRelevantCoverUrl } from "@/lib/openverse";
import { slugify } from "@/lib/slug";

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
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(
      /^https?:\/\//,
      "",
    );
    return `https://${host}`;
  }
  return "https://le-rempart.org";
}

function detectImageMime(buffer: Buffer, declared?: string): string {
  if (declared && declared.startsWith("image/") && declared !== "application/octet-stream") {
    return declared;
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
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
  if (buffer.length >= 4 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/webp";
  }
  return "image/jpeg";
}

export async function publishArticleFromCreative(input: {
  caption?: string;
  image?: { buffer: Buffer; mime: string };
}): Promise<{
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  url: string;
  coverImageUrl: string | null;
  creative?: { buffer: Buffer; mime: string };
}> {
  const caption = input.caption?.trim() || "Actualité du jour";

  const recent = await prisma.article.findFirst({
    where: {
      sourceText: caption,
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return {
      id: recent.id,
      slug: recent.slug,
      title: recent.title,
      excerpt: recent.excerpt,
      url: `${siteUrl()}/articles/${recent.slug}`,
      coverImageUrl: recent.coverImageUrl,
      creative: input.image
        ? {
            buffer: input.image.buffer,
            mime: detectImageMime(input.image.buffer, input.image.mime),
          }
        : undefined,
    };
  }

  const generated = await generateArticleFromSource({
    title: caption.slice(0, 120),
    sourceText: [
      "Contexte : créative visuelle fournie par la rédaction (image Canva avec titre en overlay).",
      `Légende / brief Telegram : ${caption}`,
      "Rédige un article d'actualité français factuel, cohérent avec ce brief et ce titre.",
    ].join("\n\n"),
  });

  const slug = await makeUniqueSlug(generated.title);
  const coverImageUrl = await resolveRelevantCoverUrl({
    title: generated.title,
    excerpt: generated.excerpt,
  });

  const creativeMime = input.image
    ? detectImageMime(input.image.buffer, input.image.mime)
    : null;

  const article = await prisma.article.create({
    data: {
      title: generated.title,
      excerpt: generated.excerpt,
      content: generated.content,
      sourceText: caption,
      slug,
      status: "published",
      publishedAt: new Date(),
      coverImageUrl,
      coverImageMime: creativeMime,
      coverImageData: input.image ? new Uint8Array(input.image.buffer) : null,
    },
  });

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    url: `${siteUrl()}/articles/${article.slug}`,
    coverImageUrl: article.coverImageUrl,
    creative: input.image
      ? { buffer: input.image.buffer, mime: creativeMime || "image/jpeg" }
      : undefined,
  };
}

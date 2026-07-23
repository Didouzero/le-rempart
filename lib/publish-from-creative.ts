import { prisma } from "@/lib/prisma";
import { generateArticleFromSource } from "@/lib/kimi";
import { slugify } from "@/lib/slug";
import { resolveWebCoverUrl } from "@/lib/wikimedia";

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

  // Anti-doublon : même brief déjà publié récemment
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
      creative: input.image,
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
  const coverImageUrl = await resolveWebCoverUrl(generated.title, caption);

  const article = await prisma.article.create({
    data: {
      title: generated.title,
      excerpt: generated.excerpt,
      content: generated.content,
      sourceText: caption,
      slug,
      status: "published",
      publishedAt: new Date(),
      // Site : uniquement image web (Wikipedia / Commons / Unsplash)
      coverImageUrl,
      // Créative Canva : Facebook uniquement
      coverImageMime: input.image?.mime || null,
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
    creative: input.image,
  };
}

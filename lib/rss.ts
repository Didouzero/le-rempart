import { articleAuthorName, SITE_AUTHOR } from "@/lib/authors";
import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import {
  CATEGORY_META,
  categoryLabel,
  PREMIUM_CATEGORY,
  type ArticleCategory,
} from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { rssPath } from "@/lib/rss-links";
import { dossierPath } from "@/lib/seo";

const FEED_SIZE = 30;
const SITE_NAME = "Le Rempart";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absoluteImage(url: string, base: string): string {
  return /^https?:\/\//.test(url) ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Flux RSS 2.0 des derniers articles publiés (tout le site ou une rubrique). */
export async function rssResponse(category?: ArticleCategory): Promise<Response> {
  const base = siteUrlBase().replace(/\/$/, "");
  let items: Array<{
    url: string;
    title: string;
    excerpt: string;
    author: string;
    section: string;
    publishedAt: Date | null;
    coverImageUrl: string | null;
  }> = [];

  try {
    const [articles, dossiers] = await withDbTimeout(
      Promise.all([
        prisma.article.findMany({
          where: { status: "published", ...(category ? { category } : {}) },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: FEED_SIZE,
          select: {
            publicId: true,
            title: true,
            excerpt: true,
            authorName: true,
            publishedAt: true,
            coverImageUrl: true,
            category: true,
          },
        }),
        // Le flux général annonce aussi les enquêtes Rempart+, comme les articles.
        category
          ? Promise.resolve([])
          : prisma.specialDossier.findMany({
              where: { publishedAt: { not: null } },
              orderBy: { publishedAt: "desc" },
              take: FEED_SIZE,
              select: {
                slug: true,
                title: true,
                excerpt: true,
                publishedAt: true,
                coverImageUrl: true,
              },
            }),
      ]),
    );
    items = [
      ...articles.map((a) => ({
        url: articlePublicUrl(a.publicId, base),
        title: a.title,
        excerpt: a.excerpt,
        author: articleAuthorName(a.authorName),
        section: categoryLabel(a.category),
        publishedAt: a.publishedAt,
        coverImageUrl: a.coverImageUrl,
      })),
      ...dossiers.map((d) => ({
        url: `${base}${dossierPath(d.slug)}`,
        title: d.title,
        excerpt: d.excerpt,
        author: SITE_AUTHOR.name,
        section: PREMIUM_CATEGORY.label,
        publishedAt: d.publishedAt,
        coverImageUrl: d.coverImageUrl,
      })),
    ]
      .sort((x, y) => (y.publishedAt?.getTime() ?? 0) - (x.publishedAt?.getTime() ?? 0))
      .slice(0, FEED_SIZE);
  } catch (err) {
    console.error("rss failed", err);
  }

  const title = category
    ? `${SITE_NAME} — ${CATEGORY_META[category].label}`
    : SITE_NAME;
  const description = category
    ? CATEGORY_META[category].description
    : "Actualité, enquêtes et analyses. Immigration, justice, économie, politique — Le Rempart, média indépendant.";
  const link = category ? `${base}/rubriques/${CATEGORY_META[category].slug}` : base;
  const lastBuild = items[0]?.publishedAt ?? new Date();

  const itemsXml = items
    .map((a) => {
      const url = a.url;
      const image = a.coverImageUrl ? absoluteImage(a.coverImageUrl, base) : null;
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${(a.publishedAt ?? new Date()).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(a.author)}</dc:creator>
      <category>${escapeXml(a.section)}</category>
      <description>${escapeXml(a.excerpt)}</description>${
        image
          ? `
      <media:content url="${escapeXml(image)}" medium="image" />`
          : ""
      }
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>fr-FR</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${base}${rssPath(category)}`)}" rel="self" type="application/rss+xml" />
    <image>
      <url>${base}/favicon.png</url>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
    </image>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
    },
  });
}

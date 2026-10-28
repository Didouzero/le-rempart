import { articleAuthorName } from "@/lib/authors";
import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import {
  CATEGORY_META,
  categoryLabel,
  type ArticleCategory,
} from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { rssPath } from "@/lib/rss-links";

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
  let articles: Array<{
    publicId: number;
    title: string;
    excerpt: string;
    authorName: string | null;
    publishedAt: Date | null;
    coverImageUrl: string | null;
    category: ArticleCategory;
  }> = [];

  try {
    articles = await withDbTimeout(
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
    );
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
  const lastBuild = articles[0]?.publishedAt ?? new Date();

  const items = articles
    .map((a) => {
      const url = articlePublicUrl(a.publicId, base);
      const image = a.coverImageUrl ? absoluteImage(a.coverImageUrl, base) : null;
      return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${(a.publishedAt ?? new Date()).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(articleAuthorName(a.authorName))}</dc:creator>
      <category>${escapeXml(categoryLabel(a.category))}</category>
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
${items}
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

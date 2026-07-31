import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import { prisma, withDbTimeout } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 900;

/** Google News : articles des ~48 dernières heures. */
export async function GET() {
  const base = siteUrlBase().replace(/\/$/, "");
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  let articles: Array<{
    publicId: number;
    title: string;
    publishedAt: Date | null;
  }> = [];

  try {
    articles = await withDbTimeout(
      prisma.article.findMany({
        where: {
          status: "published",
          publishedAt: { gte: since },
        },
        orderBy: [{ publishedAt: "desc" }],
        take: 1000,
        select: {
          publicId: true,
          title: true,
          publishedAt: true,
        },
      }),
    );
  } catch (err) {
    console.error("news-sitemap failed", err);
  }

  const urls = articles
    .map((a) => {
      const pub = (a.publishedAt || new Date()).toISOString();
      const loc = articlePublicUrl(a.publicId, base);
      const title = escapeXml(a.title);
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>Le Rempart</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${pub}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

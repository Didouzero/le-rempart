import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { dossierPath } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 900;

/** Google News : articles et enquêtes Rempart+ des ~48 dernières heures. */
export async function GET() {
  const base = siteUrlBase().replace(/\/$/, "");
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  let entries: Array<{ loc: string; title: string; publishedAt: Date | null }> = [];

  try {
    const [news, dossiers] = await withDbTimeout(
      Promise.all([
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
        prisma.specialDossier.findMany({
          where: { publishedAt: { gte: since } },
          orderBy: { publishedAt: "desc" },
          take: 100,
          select: { slug: true, title: true, publishedAt: true },
        }),
      ]),
    );
    entries = [
      ...news.map((a) => ({
        loc: articlePublicUrl(a.publicId, base),
        title: a.title,
        publishedAt: a.publishedAt,
      })),
      ...dossiers.map((d) => ({
        loc: `${base}${dossierPath(d.slug)}`,
        title: d.title,
        publishedAt: d.publishedAt,
      })),
    ];
  } catch (err) {
    console.error("news-sitemap failed", err);
  }

  const urls = entries
    .map((a) => {
      const pub = (a.publishedAt || new Date()).toISOString();
      const loc = a.loc;
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

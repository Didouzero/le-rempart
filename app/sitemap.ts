import type { MetadataRoute } from "next";
import { articlePublicPath, siteUrlBase } from "@/lib/article-url";
import { prisma, withDbTimeout } from "@/lib/prisma";

/** Rafraîchit le sitemap au plus toutes les heures. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrlBase();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${base}/nous-soutenir`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/mentions-legales`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/confidentialite`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/cgu`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/suppression-donnees`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  let articles: Array<{ publicId: number; publishedAt: Date | null; updatedAt: Date }> =
    [];
  try {
    articles = await withDbTimeout(
      prisma.article.findMany({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
          publicId: true,
          publishedAt: true,
          updatedAt: true,
        },
        take: 5000,
      }),
    );
  } catch (err) {
    console.error("sitemap: failed to load articles", err);
  }

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${base}${articlePublicPath(a.publicId)}`,
    lastModified: a.updatedAt || a.publishedAt || now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...articleEntries];
}

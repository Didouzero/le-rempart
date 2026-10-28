import type { MetadataRoute } from "next";
import { articlePublicPath, siteUrlBase } from "@/lib/article-url";
import { ARTICLE_CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { dossierPath } from "@/lib/seo";

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
    ...ARTICLE_CATEGORIES.map((key) => ({
      url: `${base}/rubriques/${CATEGORY_META[key].slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    {
      url: `${base}/rubriques/enquetes`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    },
    {
      url: `${base}/qui-sommes-nous`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/auteurs/dimitri-scudo`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${base}/s-abonner`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/connexion`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
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

  let dossiers: Array<{ slug: string; publishedAt: Date | null; updatedAt: Date }> = [];
  try {
    dossiers = await withDbTimeout(
      prisma.specialDossier.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        select: { slug: true, publishedAt: true, updatedAt: true },
        take: 1000,
      }),
    );
  } catch (err) {
    console.error("sitemap: failed to load dossiers", err);
  }

  const dossierEntries: MetadataRoute.Sitemap = dossiers.map((d) => ({
    url: `${base}${dossierPath(d.slug)}`,
    lastModified: d.updatedAt || d.publishedAt || now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...articleEntries, ...dossierEntries];
}

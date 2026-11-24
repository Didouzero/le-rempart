import type { MetadataRoute } from "next";
import { articlePublicPath, siteUrlBase } from "@/lib/article-url";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_META,
  type ArticleCategory,
} from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { dossierPath } from "@/lib/seo";
import { prismaTagSitemapRows } from "@/lib/tags";

/** Rafraîchit le sitemap au plus toutes les heures. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrlBase();

  let articles: Array<{
    publicId: number;
    publishedAt: Date | null;
    updatedAt: Date;
    category: ArticleCategory;
  }> = [];
  try {
    articles = await withDbTimeout(
      prisma.article.findMany({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
          publicId: true,
          publishedAt: true,
          updatedAt: true,
          category: true,
        },
        take: 5000,
      }),
    );
  } catch (err) {
    console.error("sitemap: failed to load articles", err);
  }

  // Dates réelles uniquement : une date recalculée à chaque passage pousse Google
  // à ignorer celles de tout le sitemap. Accueil et rubriques prennent celle du
  // dernier article publié ; les pages fixes n'en portent pas.
  const latestIn = (category?: ArticleCategory) => {
    const a = category ? articles.find((x) => x.category === category) : articles[0];
    return a?.publishedAt ?? undefined;
  };

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: latestIn(), changeFrequency: "hourly", priority: 1 },
    ...ARTICLE_CATEGORIES.map((key) => ({
      url: `${base}/rubriques/${CATEGORY_META[key].slug}`,
      lastModified: latestIn(key),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    {
      url: `${base}/auteurs/dimitri-scudo`,
      lastModified: latestIn(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    ...[
      ["/qui-sommes-nous", 0.6],
      ["/charte-editoriale", 0.6],
      ["/s-abonner", 0.5],
      ["/contact", 0.3],
      ["/mentions-legales", 0.2],
      ["/confidentialite", 0.2],
      ["/cgu", 0.2],
      ["/cgv", 0.2],
    ].map(([path, priority]) => ({
      url: `${base}${path}`,
      changeFrequency: "monthly" as const,
      priority: priority as number,
    })),
  ];

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${base}${articlePublicPath(a.publicId)}`,
    lastModified: a.updatedAt || a.publishedAt || undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  let dossiers: Array<{ publicId: number; publishedAt: Date | null; updatedAt: Date }> = [];
  try {
    dossiers = await withDbTimeout(
      prisma.specialDossier.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        select: { publicId: true, publishedAt: true, updatedAt: true },
        take: 1000,
      }),
    );
  } catch (err) {
    console.error("sitemap: failed to load dossiers", err);
  }

  const dossierEntries: MetadataRoute.Sitemap = dossiers.map((d) => ({
    url: `${base}${dossierPath(d.publicId)}`,
    lastModified: d.updatedAt || d.publishedAt || undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  staticPages.push({
    url: `${base}/rubriques/enquetes`,
    lastModified: dossiers[0]?.publishedAt ?? undefined,
    changeFrequency: "weekly",
    priority: 0.65,
  });

  let tagEntries: MetadataRoute.Sitemap = [];
  try {
    const tags = await withDbTimeout(prismaTagSitemapRows());
    tagEntries = [
      { url: `${base}/sujets`, lastModified: latestIn(), changeFrequency: "daily", priority: 0.5 },
      ...tags.map((t) => ({
        url: `${base}/sujets/${t.slug}`,
        lastModified: t.lastPublishedAt ?? undefined,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })),
    ];
  } catch (err) {
    console.error("sitemap: failed to load tags", err);
  }

  return [...staticPages, ...articleEntries, ...dossierEntries, ...tagEntries];
}

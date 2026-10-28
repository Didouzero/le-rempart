import { siteUrlBase } from "@/lib/article-url";
import { CATEGORY_META, type ArticleCategory } from "@/lib/categories";

const SITE_NAME = "Le Rempart";

export function rssPath(category?: ArticleCategory): string {
  return category ? `/rubriques/${CATEGORY_META[category].slug}/rss.xml` : "/rss.xml";
}

/** Balises <link rel="alternate" type="application/rss+xml"> (Discover « Suivre », lecteurs RSS). */
export function rssAlternateTypes(category?: ArticleCategory) {
  const base = siteUrlBase().replace(/\/$/, "");
  const feeds = [{ url: `${base}${rssPath()}`, title: SITE_NAME }];
  if (category) {
    feeds.unshift({
      url: `${base}${rssPath(category)}`,
      title: `${SITE_NAME} — ${CATEGORY_META[category].label}`,
    });
  }
  return { "application/rss+xml": feeds };
}

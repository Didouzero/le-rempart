import { siteUrlBase } from "@/lib/article-url";

export const SITE_NAME = "Le Rempart";
export const SITE_TAGLINE = "Le média de droite radicale";
export const SITE_DESCRIPTION =
  "Actualité, enquêtes et analyses. Immigration, justice, économie, politique — Le Rempart, média indépendant.";

export function absoluteUrl(path = "/"): string {
  const base = siteUrlBase().replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationJsonLd() {
  const url = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE_NAME,
    alternateName: SITE_TAGLINE,
    url,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo-wordmark.png"),
      width: 791,
      height: 127,
    },
    sameAs: [
      process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL?.trim() ||
        "https://www.facebook.com/934711579721830",
    ].filter(Boolean),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "fr-FR",
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/logo-wordmark.png"),
      },
    },
  };
}

export function newsArticleJsonLd(input: {
  title: string;
  excerpt: string;
  url: string;
  imageUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  section: string;
}) {
  const published =
    input.publishedAt?.toISOString() || new Date().toISOString();
  const modified = input.updatedAt?.toISOString() || published;
  const image = input.imageUrl || absoluteUrl("/favicon.png");

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: input.title,
    description: input.excerpt,
    image: [image],
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
    author: {
      "@type": "Organization",
      name: "Rédaction Le Rempart",
      url: absoluteUrl("/"),
    },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/logo-wordmark.png"),
        width: 791,
        height: 127,
      },
    },
    articleSection: input.section,
    inLanguage: "fr-FR",
    isAccessibleForFree: true,
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

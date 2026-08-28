import type { Metadata } from "next";
import { siteUrlBase } from "@/lib/article-url";

export const SITE_NAME = "Le Rempart";
export const SITE_TAGLINE = "Le média de droite radicale";
export const SITE_DOMAIN = "le-rempart.org";
export const SITE_URL = "https://www.le-rempart.org";
export const SITE_DESCRIPTION =
  "Actualité, enquêtes et analyses. Immigration, justice, économie, politique — Le Rempart, média indépendant.";
export const SITE_DEFAULT_TITLE = "Le Rempart — Actualité & analyses";
/** Logo carré (favicon) — signal marque / publisher Google. */
export const SITE_LOGO_SQUARE = "/favicon.png";
/** Wordmark horizontal — partages / footer. */
export const SITE_LOGO_WORDMARK = "/logo-wordmark.png";

export function absoluteUrl(path = "/"): string {
  const base = siteUrlBase().replace(/\/$/, "") || SITE_URL;
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

const FACEBOOK_PAGE =
  process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL?.trim() ||
  "https://www.facebook.com/934711579721830";

/** Métadonnées page standard (title, description, canonical, OG, Twitter). */
export function buildPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  /** Titre exact sans le template « — Le Rempart ». */
  absoluteTitle?: boolean;
  ogType?: "website" | "article";
  image?: string | null;
  imageAlt?: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(input.path);
  const image = input.image || absoluteUrl(SITE_LOGO_SQUARE);
  const title = input.absoluteTitle
    ? { absolute: input.title }
    : input.title;

  return {
    title,
    description: input.description,
    applicationName: SITE_NAME,
    authors: [{ name: "Rédaction Le Rempart", url: absoluteUrl("/") }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    alternates: { canonical: url },
    ...(input.noIndex
      ? { robots: { index: false, follow: false } }
      : {}),
    openGraph: {
      type: input.ogType || "website",
      locale: "fr_FR",
      siteName: SITE_NAME,
      title: input.absoluteTitle
        ? input.title
        : `${input.title} — ${SITE_NAME}`,
      description: input.description,
      url,
      images: [
        {
          url: image,
          alt: input.imageAlt || SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.absoluteTitle
        ? input.title
        : `${input.title} — ${SITE_NAME}`,
      description: input.description,
      images: [image],
    },
  };
}

export function organizationJsonLd() {
  const url = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE_NAME,
    alternateName: [SITE_TAGLINE, SITE_DOMAIN],
    url,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(SITE_LOGO_SQUARE),
      width: 512,
      height: 512,
    },
    image: absoluteUrl(SITE_LOGO_WORDMARK),
    sameAs: [FACEBOOK_PAGE].filter(Boolean),
    foundingDate: "2025",
    description: SITE_DESCRIPTION,
    address: {
      "@type": "PostalAddress",
      addressCountry: "FR",
    },
  };
}

/**
 * Schema WebSite — signal principal pour le « site name » Google.
 * Preferé : Le Rempart ; secours : tagline puis domaine (minuscules).
 */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: [SITE_TAGLINE, SITE_DOMAIN],
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "fr-FR",
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(SITE_LOGO_SQUARE),
        width: 512,
        height: 512,
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
  const image = input.imageUrl || absoluteUrl(SITE_LOGO_SQUARE);

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
        url: absoluteUrl(SITE_LOGO_SQUARE),
        width: 512,
        height: 512,
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

export function collectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    inLanguage: "fr-FR",
  };
}

/**
 * Illustration via Wikimedia Commons (politiques, personnalités, actu).
 * Licence libre (souvent CC) — bien plus adapté que Unsplash pour Macron, Attal, etc.
 * Doc : https://www.mediawiki.org/wiki/API:Main_page
 */

export type WikiCover = {
  url: string;
  title: string;
  artist?: string;
  license?: string;
};

function pickLargestThumb(
  info: { url?: string; thumburl?: string; responsiveUrls?: Record<string, string> },
): string | null {
  if (info.responsiveUrls) {
    const entries = Object.entries(info.responsiveUrls)
      .map(([w, u]) => ({ w: Number(w), u }))
      .filter((e) => Number.isFinite(e.w))
      .sort((a, b) => b.w - a.w);
    if (entries[0]?.u) return entries[0].u;
  }
  return info.url || info.thumburl || null;
}

export async function findWikimediaCover(
  query: string,
): Promise<WikiCover | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;

  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("generator", "search");
  searchUrl.searchParams.set("gsrsearch", q);
  searchUrl.searchParams.set("gsrnamespace", "6"); // File:
  searchUrl.searchParams.set("gsrlimit", "8");
  searchUrl.searchParams.set("prop", "imageinfo");
  searchUrl.searchParams.set(
    "iiprop",
    "url|mime|size|extmetadata|responsiveurls",
  );
  searchUrl.searchParams.set("iiurlwidth", "1600");

  const res = await fetch(searchUrl, {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (https://le-rempart.org; news site)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error("Wikimedia search failed", res.status);
    return null;
  }

  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            mime?: string;
            responsiveUrls?: Record<string, string>;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages || {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.mime?.startsWith("image/")) continue;
    // Évite PDF / SVG trop lourds ou inutiles en cover
    if (info.mime === "image/svg+xml") continue;

    const url = pickLargestThumb(info);
    if (!url) continue;

    return {
      url,
      title: page.title || q,
      artist: info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim(),
      license: info.extmetadata?.LicenseShortName?.value,
    };
  }

  return null;
}

/** Construit une requête image à partir du titre / brief. */
export function buildImageSearchQuery(title: string, caption?: string): string {
  const raw = `${title} ${caption || ""}`.trim();
  // Garde les noms propres / mots utiles, retire le bruit
  return raw
    .replace(/‼️|🇫🇷|flash|info|actualité/gi, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/**
 * Illustration web pour le site (JAMAIS la créative Canva).
 * 1) Wikipedia FR (miniatures politiques)
 * 2) Wikimedia Commons
 * 3) Unsplash (optionnel)
 */

export type WebCover = {
  url: string;
  source: "wikipedia" | "wikimedia" | "unsplash";
  title?: string;
};

export function buildImageSearchQuery(title: string, caption?: string): string {
  const raw = `${title} ${caption || ""}`.trim();
  return raw
    .replace(/‼️|🇫🇷|flash|info|actualité/gi, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Extrait un possible nom propre (2–4 mots capitalisés). */
function candidatePersonQueries(query: string): string[] {
  const words = query.split(/\s+/).filter(Boolean);
  const out: string[] = [query];
  if (words.length >= 2) out.push(words.slice(0, 2).join(" "));
  if (words.length >= 3) out.push(words.slice(0, 3).join(" "));
  // Uniques
  return [...new Set(out.filter((q) => q.length >= 3))];
}

async function wikipediaSummaryByTitle(
  pageTitle: string,
): Promise<WebCover | null> {
  const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    pageTitle.replace(/ /g, "_"),
  )}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (https://le-rempart.org; news)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    title?: string;
    originalimage?: { source?: string; width?: number; height?: number };
    thumbnail?: { source?: string; width?: number; height?: number };
    type?: string;
  };
  if (data.type === "disambiguation") return null;
  const img = data.originalimage?.source || data.thumbnail?.source;
  if (!img) return null;
  return { url: img, source: "wikipedia", title: data.title };
}

/** Recherche la bonne page Wikipedia FR (ex. "Attal" → "Gabriel Attal"). */
async function searchWikipediaTitle(query: string): Promise<string | null> {
  const q = query.trim().slice(0, 80);
  if (!q) return null;
  const searchUrl = new URL("https://fr.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srsearch", q);
  searchUrl.searchParams.set("srlimit", "5");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");

  const res = await fetch(searchUrl, {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (https://le-rempart.org; news)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { search?: Array<{ title?: string }> };
  };
  const hits = data.query?.search || [];
  const last = q.split(/\s+/).pop()?.toLowerCase() || "";
  for (const hit of hits) {
    const title = hit.title || "";
    if (!title) continue;
    if (last.length >= 3 && !title.toLowerCase().includes(last)) continue;
    // Évite les pages "Liste de…" / "Affaire…"
    if (/^liste |^affaire |^gouvernement /i.test(title)) continue;
    return title;
  }
  return hits[0]?.title || null;
}

/**
 * Photo d'une personnalité (portrait OK) via Wikipedia FR.
 * C'est LA bonne source pour Attal, Macron, Bardella, etc.
 */
export async function findWikipediaPersonPhoto(
  person: string,
): Promise<WebCover | null> {
  const q = person.trim();
  if (!q) return null;

  // 1) Titre exact / variantes
  for (const candidate of candidatePersonQueries(q)) {
    try {
      const direct = await wikipediaSummaryByTitle(candidate);
      if (direct) {
        const pageTitle = (direct.title || "").toLowerCase();
        const lastName = candidate.split(/\s+/).pop()?.toLowerCase() || "";
        if (lastName.length >= 3 && !pageTitle.includes(lastName)) continue;
        return direct;
      }
    } catch (err) {
      console.error("wikipedia person direct failed", candidate, err);
    }
  }

  // 2) Recherche Wikipedia puis summary
  try {
    const found = await searchWikipediaTitle(q);
    if (found) {
      const cover = await wikipediaSummaryByTitle(found);
      if (cover) return cover;
    }
  } catch (err) {
    console.error("wikipedia person search failed", q, err);
  }
  return null;
}

export async function findWikipediaCover(
  query: string,
): Promise<WebCover | null> {
  // Portrait accepté (comportement historique pour créatives / perso)
  return findWikipediaPersonPhoto(query);
}

function pickLargestThumb(info: {
  url?: string;
  thumburl?: string;
  responsiveUrls?: Record<string, string>;
}): string | null {
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
): Promise<WebCover | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;

  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("generator", "search");
  searchUrl.searchParams.set("gsrsearch", q);
  searchUrl.searchParams.set("gsrnamespace", "6");
  searchUrl.searchParams.set("gsrlimit", "8");
  searchUrl.searchParams.set("prop", "imageinfo");
  searchUrl.searchParams.set(
    "iiprop",
    "url|mime|size|extmetadata|responsiveurls|width|height",
  );
  searchUrl.searchParams.set("iiurlwidth", "1600");

  const res = await fetch(searchUrl, {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (https://le-rempart.org; news site)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) return null;

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
            width?: number;
            height?: number;
            responsiveUrls?: Record<string, string>;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages || {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.mime?.startsWith("image/")) continue;
    if (info.mime === "image/svg+xml") continue;
    const url = pickLargestThumb(info);
    if (!url) continue;
    return { url, source: "wikimedia", title: page.title };
  }
  return null;
}

/** Commons : uniquement images paysage (visage / photo d'actu). */
export async function findWikimediaLandscapeCover(
  query: string,
): Promise<WebCover | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;

  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("generator", "search");
  searchUrl.searchParams.set("gsrsearch", q);
  searchUrl.searchParams.set("gsrnamespace", "6");
  searchUrl.searchParams.set("gsrlimit", "15");
  searchUrl.searchParams.set("prop", "imageinfo");
  searchUrl.searchParams.set(
    "iiprop",
    "url|mime|size|responsiveurls|width|height",
  );
  searchUrl.searchParams.set("iiurlwidth", "1600");

  const res = await fetch(searchUrl, {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (https://le-rempart.org; news site)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;

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
            width?: number;
            height?: number;
            responsiveUrls?: Record<string, string>;
          }>;
        }
      >;
    };
  };

  for (const page of Object.values(data.query?.pages || {})) {
    const info = page.imageinfo?.[0];
    if (!info?.mime?.startsWith("image/") || info.mime === "image/svg+xml") {
      continue;
    }
    if (!info.width || !info.height || info.width / info.height < 1.2) continue;
    const url = pickLargestThumb(info);
    if (!url) continue;
    return { url, source: "wikimedia", title: page.title };
  }
  return null;
}

/** Wikipedia : n'accepte l'illustration que si elle est paysage. */
export async function findWikipediaLandscapeCover(
  query: string,
): Promise<WebCover | null> {
  const candidates = candidatePersonQueries(query);
  for (const q of candidates) {
    const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, "_"))}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "LeRempartBot/1.0 (https://le-rempart.org; news)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        title?: string;
        type?: string;
        originalimage?: { source?: string; width?: number; height?: number };
        thumbnail?: { source?: string; width?: number; height?: number };
      };
      if (data.type === "disambiguation") continue;
      const pageTitle = (data.title || "").toLowerCase();
      const lastName = q.split(/\s+/).pop()?.toLowerCase() || "";
      if (lastName.length >= 3 && !pageTitle.includes(lastName)) continue;

      const img = data.originalimage || data.thumbnail;
      if (!img?.source || !img.width || !img.height) continue;
      if (img.width / img.height < 1.2) continue;
      return { url: img.source, source: "wikipedia", title: data.title };
    } catch (err) {
      console.error("wikipedia landscape failed", q, err);
    }
  }
  return null;
}

export async function resolveWebCoverUrl(
  title: string,
  caption: string,
): Promise<string | null> {
  const query = buildImageSearchQuery(title, caption);
  const tries = candidatePersonQueries(query);

  for (const q of tries) {
    const wiki = await findWikipediaLandscapeCover(q);
    if (wiki?.url) return wiki.url;
  }

  for (const q of tries) {
    const commons = await findWikimediaLandscapeCover(q);
    if (commons?.url) return commons.url;
  }

  try {
    const { findUnsplashCoverUrl } = await import("@/lib/unsplash");
    return await findUnsplashCoverUrl(query);
  } catch {
    return null;
  }
}

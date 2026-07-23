/**
 * Recherche d'illustration pertinente (scène réelle).
 * Openverse (Creative Commons) — pas de clé API.
 */

export async function findOpenverseCoverUrl(
  query: string,
): Promise<string | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;

  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", "5");
  url.searchParams.set("license_type", "commercial,modification");
  url.searchParams.set("category", "photograph");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (https://le-rempart.org; news illustrations)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error("Openverse error", res.status);
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<{ url?: string; thumbnail?: string }>;
  };

  for (const r of data.results || []) {
    const img = r.url || r.thumbnail;
    if (img && /^https?:\/\//.test(img)) return img;
  }
  return null;
}

export async function resolveRelevantCoverUrl(input: {
  title: string;
  excerpt?: string;
}): Promise<string | null> {
  const { suggestVisualSearchQueries } = await import("@/lib/visual-queries");
  const queries = await suggestVisualSearchQueries(input);

  for (const q of queries) {
    try {
      const openverse = await findOpenverseCoverUrl(q);
      if (openverse) return openverse;
    } catch (err) {
      console.error("openverse failed", q, err);
    }
  }

  // Unsplash si clé présente
  try {
    const { findUnsplashCoverUrl } = await import("@/lib/unsplash");
    for (const q of queries) {
      const u = await findUnsplashCoverUrl(q);
      if (u) return u;
    }
  } catch {
    // ignore
  }

  // Wikimedia en dernier, avec les requêtes VISUELLES (pas le titre brut)
  try {
    const { findWikimediaCover, findWikipediaCover } = await import(
      "@/lib/wikimedia"
    );
    for (const q of queries) {
      const wiki = await findWikipediaCover(q);
      if (wiki?.url) return wiki.url;
      const commons = await findWikimediaCover(q);
      if (commons?.url) return commons.url;
    }
  } catch (err) {
    console.error("wiki fallback failed", err);
  }

  return null;
}

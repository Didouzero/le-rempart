/**
 * Recherche d'illustration pertinente.
 * Personnalité → photo paysage avec visage visible (pas forcément Wikipedia).
 * Sinon → scène thématique paysage.
 */

import { extractPersonCandidates } from "@/lib/person-names";
import { fallbackVisualQueries } from "@/lib/visual-queries";

function isLandscape(width?: number | null, height?: number | null): boolean {
  if (!width || !height || width <= 0 || height <= 0) return false;
  return width / height >= 1.2;
}

export async function findOpenverseCoverUrl(
  query: string,
  opts?: { landscapeOnly?: boolean },
): Promise<string | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;

  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", "12");
  url.searchParams.set("license_type", "commercial,modification");
  url.searchParams.set("category", "photograph");
  if (opts?.landscapeOnly !== false) {
    url.searchParams.set("aspect_ratio", "wide");
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "LeRempartBot/1.0 (https://le-rempart.org; news illustrations)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    console.error("Openverse error", res.status);
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<{
      url?: string;
      thumbnail?: string;
      width?: number;
      height?: number;
      title?: string;
    }>;
  };

  for (const r of data.results || []) {
    const img = r.url || r.thumbnail;
    if (!img || !/^https?:\/\//.test(img)) continue;
    if (opts?.landscapeOnly === false) return img;
    if (isLandscape(r.width, r.height) || (!r.width && !r.height)) return img;
  }
  return null;
}

async function findLandscapePersonPhoto(person: string): Promise<string | null> {
  // 1) Wikipedia FR en premier : visage identifiable (orientation libre)
  try {
    const { findWikipediaCover } = await import("@/lib/wikimedia");
    const wiki = await findWikipediaCover(person);
    if (wiki?.url) return wiki.url;
  } catch (err) {
    console.error("wikipedia person failed", person, err);
  }

  // 2) Wikimedia Commons (portrait OK)
  try {
    const { findWikimediaCover } = await import("@/lib/wikimedia");
    const commons = await findWikimediaCover(person);
    if (commons?.url) return commons.url;
  } catch (err) {
    console.error("commons person failed", person, err);
  }

  const queries = [`${person} portrait`, `${person}`, `${person} france`];

  // 3) Openverse (visage / nom)
  for (const q of queries) {
    try {
      const url = await findOpenverseCoverUrl(q, { landscapeOnly: false });
      if (url) return url;
    } catch (err) {
      console.error("openverse person failed", q, err);
    }
  }

  // 4) Unsplash
  try {
    const { findUnsplashCoverUrl } = await import("@/lib/unsplash");
    for (const q of queries) {
      const u = await findUnsplashCoverUrl(q);
      if (u) return u;
    }
  } catch {
    // ignore
  }

  return null;
}

async function findPersonPortraitUrl(title: string): Promise<string | null> {
  const candidates = extractPersonCandidates(title);
  if (candidates.length === 0) return null;

  for (const person of candidates) {
    const url = await findLandscapePersonPhoto(person);
    if (url) return url;
  }
  return null;
}

export async function resolveRelevantCoverUrl(input: {
  title: string;
  excerpt?: string;
}): Promise<string | null> {
  try {
    const portrait = await findPersonPortraitUrl(input.title);
    if (portrait) return portrait;
  } catch (err) {
    console.error("person portrait failed", err);
  }

  const queries = fallbackVisualQueries(
    `${input.title} ${input.excerpt || ""}`,
  ).slice(0, 2);

  for (const q of queries) {
    try {
      const openverse = await findOpenverseCoverUrl(q, { landscapeOnly: true });
      if (openverse) return openverse;
    } catch (err) {
      console.error("openverse failed", q, err);
    }
  }

  try {
    const { findUnsplashCoverUrl } = await import("@/lib/unsplash");
    const u = await findUnsplashCoverUrl(queries[0] || input.title);
    if (u) return u;
  } catch {
    // ignore
  }

  return null;
}

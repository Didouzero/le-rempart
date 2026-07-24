/**
 * Recherche d'illustration pertinente.
 * 1) Portrait Wikipedia si personnalité détectée dans le titre
 * 2) Scène Openverse sinon
 */

import { extractPersonCandidates } from "@/lib/person-names";
import { fallbackVisualQueries } from "@/lib/visual-queries";

export async function findOpenverseCoverUrl(
  query: string,
): Promise<string | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;

  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", "3");
  url.searchParams.set("license_type", "commercial,modification");
  url.searchParams.set("category", "photograph");

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "LeRempartBot/1.0 (https://le-rempart.org; news illustrations)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5000),
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

async function findPersonPortraitUrl(title: string): Promise<string | null> {
  const candidates = extractPersonCandidates(title);
  if (candidates.length === 0) return null;

  const { findWikipediaCover, findWikimediaCover } = await import(
    "@/lib/wikimedia"
  );

  for (const person of candidates) {
    try {
      const wiki = await findWikipediaCover(person);
      if (wiki?.url) return wiki.url;
    } catch (err) {
      console.error("person wikipedia failed", person, err);
    }
  }

  for (const person of candidates) {
    try {
      const commons = await findWikimediaCover(person);
      if (commons?.url) return commons.url;
    } catch (err) {
      console.error("person commons failed", person, err);
    }
  }

  return null;
}

export async function resolveRelevantCoverUrl(input: {
  title: string;
  excerpt?: string;
}): Promise<string | null> {
  // Personnalité dans le titre → portrait systématique
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
      const openverse = await findOpenverseCoverUrl(q);
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

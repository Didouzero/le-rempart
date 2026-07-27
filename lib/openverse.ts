/**
 * Recherche d'illustration pertinente.
 * Personnalité → photo PAYSAGE où la personne apparaît (pas un portrait wiki serré).
 * Sinon → scène thématique paysage.
 */

import { extractPersonCandidates } from "@/lib/person-names";
import { fallbackVisualQueries } from "@/lib/visual-queries";

function isLandscape(width?: number | null, height?: number | null): boolean {
  if (!width || !height || width <= 0 || height <= 0) return false;
  return width / height >= 1.2;
}

function personNameTokens(person: string): string[] {
  return person
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s'-]+/)
    .filter(
      (w) =>
        w.length >= 3 && !["le", "la", "de", "du", "des", "van", "von"].includes(w),
    );
}

function textMentionsPerson(text: string, person: string): boolean {
  const hay = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const tokens = personNameTokens(person);
  if (tokens.length === 0) return false;
  const last = tokens[tokens.length - 1];
  return hay.includes(last);
}

type OpenverseHit = {
  url: string;
  width?: number;
  height?: number;
  title?: string;
  creator?: string;
};

export async function findOpenverseCoverUrl(
  query: string,
  opts?: { landscapeOnly?: boolean; person?: string },
): Promise<string | null> {
  const urls = await findOpenverseCoverUrls(query, { ...opts, limit: 1 });
  return urls[0] || null;
}

export async function findOpenverseCoverUrls(
  query: string,
  opts?: { landscapeOnly?: boolean; person?: string; limit?: number },
): Promise<string[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const limit = Math.max(1, Math.min(opts?.limit ?? 8, 20));

  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", "20");
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
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    console.error("Openverse error", res.status);
    return [];
  }

  const data = (await res.json()) as {
    results?: Array<{
      url?: string;
      thumbnail?: string;
      width?: number;
      height?: number;
      title?: string;
      creator?: string;
    }>;
  };

  const hits: OpenverseHit[] = [];
  for (const r of data.results || []) {
    const img = r.url || r.thumbnail;
    if (!img || !/^https?:\/\//.test(img)) continue;
    if (opts?.landscapeOnly !== false) {
      if (r.width && r.height && !isLandscape(r.width, r.height)) continue;
    }
    // Préférer jpeg/png dans l'URL si possible
    hits.push({
      url: img,
      width: r.width,
      height: r.height,
      title: r.title,
      creator: r.creator,
    });
  }

  if (opts?.person) {
    const matched = hits.filter((h) =>
      textMentionsPerson(`${h.title || ""} ${h.creator || ""}`, opts.person!),
    );
    if (matched.length) return matched.slice(0, limit).map((h) => h.url);
  }

  // Trie : URLs qui ressemblent à jpeg/png d'abord
  hits.sort((a, b) => {
    const score = (u: string) =>
      /\.(jpe?g|png)(\?|$)/i.test(u) ? 0 : /\.webp(\?|$)/i.test(u) ? 1 : 2;
    return score(a.url) - score(b.url);
  });

  return hits.slice(0, limit).map((h) => h.url);
}

async function findLandscapePersonPhoto(person: string): Promise<string | null> {
  const queries = [
    `${person}`,
    `${person} portrait`,
    `${person} france`,
    `${person} ministre`,
  ];

  // 1) Openverse paysage libre de droits (Flickr etc.)
  for (const q of queries) {
    try {
      const url = await findOpenverseCoverUrl(q, {
        landscapeOnly: true,
        person,
      });
      if (url) return url;
    } catch (err) {
      console.error("openverse person failed", q, err);
    }
  }

  // 2) Unsplash paysage
  try {
    const { findUnsplashCoverUrl } = await import("@/lib/unsplash");
    for (const q of queries) {
      const u = await findUnsplashCoverUrl(q);
      if (u) return u;
    }
  } catch {
    // ignore
  }

  // 3) Wikimedia Commons paysage uniquement
  try {
    const { findWikimediaLandscapeCover } = await import("@/lib/wikimedia");
    for (const q of [person, `${person} portrait`]) {
      const commons = await findWikimediaLandscapeCover(q);
      if (commons?.url) return commons.url;
    }
  } catch (err) {
    console.error("commons landscape person failed", person, err);
  }

  // 4) Wikipedia SEULEMENT si déjà paysage (pas les portraits serrés)
  try {
    const { findWikipediaLandscapeCover } = await import("@/lib/wikimedia");
    const wiki = await findWikipediaLandscapeCover(person);
    if (wiki?.url) return wiki.url;
  } catch (err) {
    console.error("wikipedia landscape person failed", person, err);
  }

  return null;
}

async function findPersonCoverUrl(title: string): Promise<string | null> {
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
    const personCover = await findPersonCoverUrl(input.title);
    if (personCover) return personCover;
  } catch (err) {
    console.error("person landscape cover failed", err);
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

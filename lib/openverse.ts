/**
 * Recherche d'illustration pertinente.
 * Personnalité → photo PAYSAGE où la personne apparaît (pas un portrait wiki serré).
 * Sinon → scène thématique paysage, requêtes Kimi + fallbacks, anti-répétition.
 */

import { extractPersonCandidates } from "@/lib/person-names";
import { prisma } from "@/lib/prisma";
import {
  hitIsGloballyBanned,
  hitMatchesTopic,
  isCrimeOrArrestTopic,
  isSceneFirstTopic,
  suggestVisualSearchQueries,
  topicImageKeywords,
} from "@/lib/visual-queries";

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

async function recentlyUsedCoverUrls(limit = 50): Promise<Set<string>> {
  try {
    const rows = await prisma.article.findMany({
      where: { coverImageUrl: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { coverImageUrl: true },
    });
    return new Set(
      rows
        .map((r) => r.coverImageUrl)
        .filter((u): u is string => Boolean(u)),
    );
  } catch (err) {
    console.error("recentlyUsedCoverUrls failed", err);
    return new Set();
  }
}

export async function findOpenverseCoverUrl(
  query: string,
  opts?: {
    landscapeOnly?: boolean;
    person?: string;
    topic?: string;
    exclude?: Set<string>;
  },
): Promise<string | null> {
  const urls = await findOpenverseCoverUrls(query, { ...opts, limit: 1 });
  return urls[0] || null;
}

export async function findOpenverseCoverUrls(
  query: string,
  opts?: {
    landscapeOnly?: boolean;
    person?: string;
    limit?: number;
    topic?: string;
    exclude?: Set<string>;
  },
): Promise<string[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const limit = Math.max(1, Math.min(opts?.limit ?? 8, 20));
  const topicBlob = `${opts?.topic || ""} ${q}`.trim();
  const page = 1 + Math.floor(Math.random() * 2);

  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", q);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "24");
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
    if (opts?.exclude?.has(img)) continue;
    if (opts?.landscapeOnly !== false) {
      if (r.width && r.height && !isLandscape(r.width, r.height)) continue;
    }
    // Évite les miniatures trop petites
    if ((r.width || 0) > 0 && (r.width || 0) < 900) continue;
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
    if (matched.length) {
      matched.sort(
        (a, b) =>
          (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0),
      );
      return matched.slice(0, limit).map((h) => h.url);
    }
  }

  const keywords = topicImageKeywords(topicBlob);
  const scored = hits
    .map((h) => {
      const blob = `${h.title || ""} ${h.creator || ""} ${h.url}`;
      const relevant = hitMatchesTopic(blob, keywords);
      const fmt = /\.(jpe?g|png)(\?|$)/i.test(h.url)
        ? 0
        : /\.webp(\?|$)/i.test(h.url)
          ? 1
          : 2;
      const area = (h.width || 1200) * (h.height || 800);
      return { h, blob, relevant, fmt, area };
    })
    .filter((x) => {
      if (hitIsGloballyBanned(x.blob)) return false;
      if (keywords.must.length > 0 && !x.relevant) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
      if (a.fmt !== b.fmt) return a.fmt - b.fmt;
      return b.area - a.area;
    });

  // Parmi le top, tire au sort pour casser les boucles
  const pool = scored.slice(0, Math.min(scored.length, limit + 4));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit).map((x) => x.h.url);
}

async function findLandscapePersonPhoto(
  person: string,
  exclude?: Set<string>,
): Promise<string | null> {
  const queries = [
    `${person}`,
    `${person} portrait`,
    `${person} france`,
    `${person} ministre`,
  ];

  for (const q of queries) {
    try {
      const url = await findOpenverseCoverUrl(q, {
        landscapeOnly: true,
        person,
        exclude,
      });
      if (url) return url;
    } catch (err) {
      console.error("openverse person failed", q, err);
    }
  }

  try {
    const { findUnsplashCoverUrls } = await import("@/lib/unsplash");
    for (const q of queries) {
      const urls = await findUnsplashCoverUrls(q, { limit: 4, exclude });
      if (urls[0]) return urls[0];
    }
  } catch {
    // ignore
  }

  try {
    const { findWikimediaLandscapeCover } = await import("@/lib/wikimedia");
    for (const q of [person, `${person} portrait`]) {
      const commons = await findWikimediaLandscapeCover(q);
      if (commons?.url && !exclude?.has(commons.url)) return commons.url;
    }
  } catch (err) {
    console.error("commons landscape person failed", person, err);
  }

  try {
    const { findWikipediaLandscapeCover } = await import("@/lib/wikimedia");
    const wiki = await findWikipediaLandscapeCover(person);
    if (wiki?.url && !exclude?.has(wiki.url)) return wiki.url;
  } catch (err) {
    console.error("wikipedia landscape person failed", person, err);
  }

  return null;
}

async function findPersonCoverUrl(
  title: string,
  exclude?: Set<string>,
): Promise<string | null> {
  const candidates = extractPersonCandidates(title);
  if (candidates.length === 0) return null;

  for (const person of candidates) {
    const url = await findLandscapePersonPhoto(person, exclude);
    if (url) return url;
  }
  return null;
}

export async function resolveRelevantCoverUrl(input: {
  title: string;
  excerpt?: string;
}): Promise<string | null> {
  const exclude = await recentlyUsedCoverUrls(60);
  const queries = await suggestVisualSearchQueries({
    title: input.title,
    excerpt: input.excerpt,
  });
  const sceneFirst = isSceneFirstTopic(input.title);

  const tryThematic = async (): Promise<string | null> => {
    for (const q of queries.slice(0, 8)) {
      try {
        const urls = await findOpenverseCoverUrls(q, {
          landscapeOnly: true,
          limit: 8,
          topic: input.title,
          exclude,
        });
        for (const u of urls) {
          if (u && !exclude.has(u)) return u;
        }
      } catch (err) {
        console.error("openverse failed", q, err);
      }
    }
    try {
      const { findUnsplashCoverUrls } = await import("@/lib/unsplash");
      for (const q of queries.slice(0, 5)) {
        if (!q || /allah|dieu|god|jesus/i.test(q)) continue;
        const urls = await findUnsplashCoverUrls(q, { limit: 6, exclude });
        for (const u of urls) {
          if (u && !exclude.has(u)) return u;
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  const tryPerson = async (): Promise<string | null> => {
    if (isSceneFirstTopic(input.title) && isCrimeOrArrestTopic(input.title)) {
      // Faits divers : scène / lieu d'abord ; portrait seulement si pas d'arrestation explicite
      if (/interpell|arrestation|fusillade|attentat/.test(input.title.toLowerCase())) {
        return null;
      }
    }
    try {
      return await findPersonCoverUrl(input.title, exclude);
    } catch (err) {
      console.error("person landscape cover failed", err);
      return null;
    }
  };

  if (sceneFirst) {
    const thematic = await tryThematic();
    if (thematic) return thematic;
    const person = await tryPerson();
    if (person) return person;
    return null;
  }

  const person = await tryPerson();
  if (person) return person;
  return tryThematic();
}

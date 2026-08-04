/**
 * Recherche d'illustration pertinente.
 * Personnalité politique → Wikipedia FR (portrait OK : Attal, Macron…).
 * Sinon → scène thématique (Pexels/Pixabay/Commons…), anti-répétition.
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
    /** Si true : n'exige pas les must-keywords (dernier recours). */
    relaxTopic?: boolean;
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
    // 401/429 : inutile d'insister dans la même résolution
    if (res.status === 401 || res.status === 429) {
      throw new Error(`Openverse unavailable (${res.status})`);
    }
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
      // Ne jette que si dimensions connues ET clairement portrait
      if (r.width && r.height && !isLandscape(r.width, r.height)) continue;
    }
    // Ne jette les petites tailles que si la largeur est connue
    if (typeof r.width === "number" && r.width > 0 && r.width < 640) continue;
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
      // Strict seulement si on a assez de hits pertinents ; sinon on garde
      if (
        !opts?.relaxTopic &&
        keywords.must.length > 0 &&
        !x.relevant
      ) {
        return false;
      }
      return true;
    });

  // Si le filtre sujet a tout tué → garder les hits non bannis
  const poolBase =
    scored.length > 0
      ? scored
      : hits
          .map((h) => {
            const blob = `${h.title || ""} ${h.creator || ""} ${h.url}`;
            if (hitIsGloballyBanned(blob)) return null;
            return {
              h,
              blob,
              relevant: false,
              fmt: 1,
              area: (h.width || 1200) * (h.height || 800),
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));

  poolBase.sort((a, b) => {
    if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
    if (a.fmt !== b.fmt) return a.fmt - b.fmt;
    return b.area - a.area;
  });

  const pool = poolBase.slice(0, Math.min(poolBase.length, limit + 4));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit).map((x) => x.h.url);
}

async function findPersonPhoto(
  person: string,
  exclude?: Set<string>,
): Promise<string | null> {
  // 1) Wikipedia FR — vraie photo de la personne (portrait accepté)
  try {
    const { findWikipediaPersonPhoto } = await import("@/lib/wikimedia");
    const wiki = await findWikipediaPersonPhoto(person);
    if (wiki?.url && !exclude?.has(wiki.url)) return wiki.url;
  } catch (err) {
    console.error("wikipedia person photo failed", person, err);
  }

  // 2) Wikimedia Commons (toute orientation)
  try {
    const { findWikimediaCover } = await import("@/lib/wikimedia");
    for (const q of [person, `${person} portrait`, `${person} France`]) {
      const commons = await findWikimediaCover(q);
      if (commons?.url && !exclude?.has(commons.url)) return commons.url;
    }
  } catch (err) {
    console.error("commons person failed", person, err);
  }

  // 3) Banques stock en secours (rarement utiles pour les politiques FR)
  const queries = [`${person}`, `${person} portrait`, `${person} france`];
  try {
    const { findUnsplashCoverUrls } = await import("@/lib/unsplash");
    for (const q of queries) {
      const urls = await findUnsplashCoverUrls(q, { limit: 4, exclude });
      if (urls[0]) return urls[0];
    }
  } catch {
    // ignore
  }

  for (const q of queries) {
    try {
      const url = await findOpenverseCoverUrl(q, {
        landscapeOnly: false,
        person,
        exclude,
      });
      if (url) return url;
    } catch (err) {
      console.error("openverse person failed", q, err);
      break;
    }
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
    const url = await findPersonPhoto(person, exclude);
    if (url) return url;
  }
  return null;
}

async function firstFromBanks(
  queries: string[],
  topic: string,
  exclude: Set<string> | undefined,
  opts?: { relaxTopic?: boolean },
): Promise<string | null> {
  const { findPexelsCoverUrls } = await import("@/lib/pexels");
  const { findPixabayCoverUrls } = await import("@/lib/pixabay");
  const { findUnsplashCoverUrls } = await import("@/lib/unsplash");
  const { findWikimediaLandscapeCover } = await import("@/lib/wikimedia");

  let openverseDisabled = false;
  let openverseTries = 0;

  for (const q of queries) {
    if (!q || /allah|dieu|god|jesus/i.test(q)) continue;

    // 1) Pexels / Pixabay (gros catalogues — clés API recommandées)
    try {
      for (const u of await findPexelsCoverUrls(q, { limit: 8, exclude })) {
        if (u) return u;
      }
    } catch (err) {
      console.error("pexels failed", q, err);
    }
    try {
      for (const u of await findPixabayCoverUrls(q, { limit: 8, exclude })) {
        if (u) return u;
      }
    } catch (err) {
      console.error("pixabay failed", q, err);
    }

    // 2) Unsplash
    try {
      for (const u of await findUnsplashCoverUrls(q, { limit: 6, exclude })) {
        if (u) return u;
      }
    } catch {
      // ignore
    }

    // 3) Wikimedia Commons — documentaire (campements, villes…), pas seulement paysage
    try {
      const { findWikimediaCover } = await import("@/lib/wikimedia");
      const commonsAny = await findWikimediaCover(q);
      if (commonsAny?.url && !exclude?.has(commonsAny.url)) return commonsAny.url;
      const commons = await findWikimediaLandscapeCover(q);
      if (commons?.url && !exclude?.has(commons.url)) return commons.url;
    } catch {
      // ignore
    }

    // 4) Openverse en dernier (souvent 401/429 sans auth / quota)
    if (!openverseDisabled && openverseTries < 3) {
      openverseTries += 1;
      try {
        const urls = await findOpenverseCoverUrls(q, {
          landscapeOnly: true,
          limit: 8,
          topic,
          exclude,
          relaxTopic: opts?.relaxTopic,
        });
        for (const u of urls) {
          if (u) return u;
        }
      } catch (err) {
        console.error("openverse failed", q, err);
        openverseDisabled = true;
      }
    }
  }
  return null;
}

export async function resolveRelevantCoverUrl(input: {
  title: string;
  excerpt?: string;
}): Promise<string | null> {
  const exclude = await recentlyUsedCoverUrls(40);
  const queries = await suggestVisualSearchQueries({
    title: input.title,
    excerpt: input.excerpt,
  });
  const sceneFirst = isSceneFirstTopic(input.title);
  const qSlice = queries.slice(0, 8);

  const namedPeople = extractPersonCandidates(input.title);

  const tryPerson = async (
    usedExclude?: Set<string>,
  ): Promise<string | null> => {
    // Si un politique est nommé, on veut SA photo — même sur un fait divers
    if (
      namedPeople.length === 0 &&
      isSceneFirstTopic(input.title) &&
      isCrimeOrArrestTopic(input.title)
    ) {
      if (/interpell|arrestation|fusillade|attentat/.test(input.title.toLowerCase())) {
        return null;
      }
    }
    try {
      return await findPersonCoverUrl(input.title, usedExclude);
    } catch (err) {
      console.error("person cover failed", err);
      return null;
    }
  };

  // Personnalité citée → Wikipedia d'abord (Attal, Macron…), pas du stock générique
  if (namedPeople.length > 0) {
    const person = await tryPerson(exclude);
    if (person) return person;
  }

  // Passe thématique
  if (sceneFirst || namedPeople.length === 0) {
    const thematic = await firstFromBanks(qSlice, input.title, exclude);
    if (thematic) return thematic;
  }

  if (namedPeople.length === 0) {
    const person = await tryPerson(exclude);
    if (person) return person;
  }

  // Passe 2 : mêmes banques, sans exclusion (mieux une image déjà vue que rien)
  const soft = await firstFromBanks(qSlice, input.title, undefined, {
    relaxTopic: true,
  });
  if (soft) return soft;

  // Passe 3 : requêtes ultra simples de secours
  const emergency = [
    "france urban street documentary",
    "dilapidated building europe",
    "city outskirts france",
    "paris street night",
  ];
  return firstFromBanks(emergency, input.title, undefined, { relaxTopic: true });
}

import { fetchSourceText } from "@/lib/fetch-source";
import {
  enrichSourceWithTier,
  estimateSourceTier,
  rankingScoreFromTier,
} from "@/lib/research/source-hierarchy";
import {
  extractSubjectEntities,
  isOnTopicHit,
  isStrongHit,
  relevanceScore,
  searchWebForSubject,
  type SubjectEntities,
  type WebSearchHit,
} from "@/lib/research/web-search";
import type { SourceDocument, SourceType } from "@/lib/research/types";

export type SourceCandidate = {
  url: string;
  title: string;
  publisher?: string;
  publicationDate?: string;
  discoveredVia: string;
  snippet?: string;
};

const MAX_DEEP_SOURCES = 6;
const MAX_EXCERPT = 9000;
const MIN_SCRAPE_CHARS = 280;
const MIN_SNIPPET_CHARS = 80;
/** Scrapes menés en parallèle : garde le budget temps Vercel raisonnable. */
const SCRAPE_CONCURRENCY = 3;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function classifySourceType(url: string, publisher?: string): SourceType {
  const tier = estimateSourceTier({ url, publisher });
  if (tier <= 4) return tier === 2 ? "primary" : "official";
  if (tier >= 9) return "social";
  return "secondary";
}

function candidateToHit(c: SourceCandidate): WebSearchHit {
  return {
    title: c.title,
    url: c.url,
    snippet: c.snippet || "",
    publisher: c.publisher,
    publicationDate: c.publicationDate,
    discoveredVia: c.discoveredVia,
  };
}

/**
 * Pertinence sujet d'abord, hiérarchie de source ensuite.
 * Une source hors sujet de tier 1 reste inutile pour l'article.
 */
function rankCandidate(
  c: SourceCandidate,
  subject: string,
  entities: SubjectEntities,
): number {
  const tier = estimateSourceTier({
    url: c.url,
    publisher: c.publisher,
    title: c.title,
  });
  let score = relevanceScore(candidateToHit(c), subject, entities);
  score += rankingScoreFromTier(tier) * 1.5;
  if (c.discoveredVia === "subject.sourceUrl") score += 400;
  if ((c.snippet || "").length > 200) score += 20;
  return score;
}

const REDIRECTOR_RE = /news\.google\.|bing\.com\/(ck|news)|t\.co\/|goo\.gl\//i;

/** Ne résout que les redirecteurs connus : évite un GET complet inutile. */
async function resolveFinalUrl(url: string): Promise<string> {
  if (!REDIRECTOR_RE.test(url)) return url;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(12_000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

function hitToCandidate(hit: WebSearchHit): SourceCandidate {
  return {
    url: hit.url,
    title: hit.title,
    publisher: hit.publisher,
    publicationDate: hit.publicationDate,
    discoveredVia: hit.discoveredVia,
    snippet: hit.snippet,
  };
}

/**
 * Découverte : recherche web d'abord (caption seule suffit).
 */
export async function discoverSourceCandidates(input: {
  title: string;
  sourceUrl?: string;
  extraQueries?: string[];
  fast?: boolean;
  /** Ne pas lancer Google/Bing/Moonshot — URL fournie + texte scrapé suffisent. */
  skipWebSearch?: boolean;
}): Promise<SourceCandidate[]> {
  const candidates: SourceCandidate[] = [];

  if (input.sourceUrl && /^https?:\/\//i.test(input.sourceUrl)) {
    candidates.push({
      url: input.sourceUrl,
      title: input.title,
      discoveredVia: "subject.sourceUrl",
    });
  }

  if (!input.skipWebSearch) {
    try {
      const hits = await searchWebForSubject({
        subject: input.title,
        extraQueries: input.extraQueries,
        fast: input.fast,
      });
      candidates.push(...hits.map(hitToCandidate));
    } catch (err) {
      console.error("web search failed", err);
    }
  }

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = c.url.split("?")[0]!;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const entities = extractSubjectEntities(input.title);
  unique.sort(
    (a, b) =>
      rankCandidate(b, input.title, entities) -
      rankCandidate(a, input.title, entities),
  );

  // Pages d'article sur le sujet d'abord : une page d'accueil qui cite
  // l'entité ne fournit aucune matière au dossier.
  const strong = unique.filter(
    (c) =>
      c.discoveredVia === "subject.sourceUrl" ||
      isStrongHit(candidateToHit(c), entities),
  );
  const onTopic = unique.filter(
    (c) => !strong.includes(c) && isOnTopicHit(candidateToHit(c), entities),
  );
  const rest = unique.filter(
    (c) => !strong.includes(c) && !onTopic.includes(c),
  );
  return [...strong, ...onTopic.slice(0, 4), ...rest.slice(0, 2)].slice(0, 14);
}

function snippetDocument(candidate: SourceCandidate, resolved: string): SourceDocument {
  const snippet = (candidate.snippet || "").trim();
  const excerpt = [
    candidate.title,
    snippet,
    `Source découverte via recherche web (${candidate.discoveredVia}).`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_EXCERPT);

  return enrichSourceWithTier({
    url: resolved,
    title: candidate.title,
    publisher: candidate.publisher || hostOf(resolved),
    language: "fr",
    publicationDate: candidate.publicationDate,
    retrievedAt: new Date().toISOString(),
    type: classifySourceType(resolved, candidate.publisher),
    scraped: false,
    confidence: 0,
    excerpt,
    notes: `snippet_only; discoveredVia=${candidate.discoveredVia}`,
  });
}

async function scrapeCandidate(
  candidate: SourceCandidate,
): Promise<SourceDocument | null> {
  const resolved = await resolveFinalUrl(candidate.url);
  try {
    const text = await fetchSourceText(resolved);
    if (text.trim().length >= MIN_SCRAPE_CHARS) {
      return enrichSourceWithTier({
        url: resolved,
        title: candidate.title,
        publisher: candidate.publisher || hostOf(resolved),
        language: "fr",
        publicationDate: candidate.publicationDate,
        retrievedAt: new Date().toISOString(),
        type: classifySourceType(resolved, candidate.publisher),
        scraped: true,
        confidence: 0,
        excerpt: text.slice(0, MAX_EXCERPT),
        notes: `discoveredVia=${candidate.discoveredVia}`,
      });
    }
  } catch (err) {
    console.error("research scrape failed", resolved, err);
  }

  // Fallback critique : garder le snippet de recherche (sinon dossier vide).
  if ((candidate.snippet || "").trim().length >= MIN_SNIPPET_CHARS) {
    return snippetDocument(candidate, resolved);
  }

  // Au minimum titre + URL (faible, mais mieux que rien pour le builder)
  if (candidate.title.length >= 20) {
    return snippetDocument(
      {
        ...candidate,
        snippet:
          candidate.snippet ||
          `Résultat de recherche : ${candidate.title}. Contenu page non accessible au scrape.`,
      },
      resolved,
    );
  }

  return null;
}

/**
 * Collecte : recherche web → scrape si possible → sinon snippets.
 * Une caption Telegram seule doit suffire.
 */
export async function collectDeepSources(input: {
  title: string;
  sourceUrl?: string;
  sourceText?: string;
  extraQueries?: string[];
  alreadyHaveUrls?: string[];
  fast?: boolean;
  skipWebSearch?: boolean;
}): Promise<{ sources: SourceDocument[]; seedNotes?: string }> {
  const seed = input.sourceText?.trim() || "";
  const isCaptionSeed =
    /^Accroche éditoriale secondaire/i.test(seed) || seed.length < 80;
  const richSeed = Boolean(seed && !isCaptionSeed && seed.length >= 400);

  // Déjà scrapé en amont (Telegram) : pas de re-fetch ni de web search.
  if (input.skipWebSearch && richSeed) {
    const seedDoc = enrichSourceWithTier({
      url: input.sourceUrl || "seed:sourceText",
      title: `Notes / texte source — ${input.title}`.slice(0, 160),
      publisher: "source fournie",
      language: "fr",
      retrievedAt: new Date().toISOString(),
      type: input.sourceUrl ? classifySourceType(input.sourceUrl) : "primary",
      scraped: true,
      confidence: 0,
      excerpt: seed.slice(0, MAX_EXCERPT),
      notes: "subject.sourceText",
    });
    return { sources: [seedDoc], seedNotes: undefined };
  }

  const have = new Set(
    (input.alreadyHaveUrls || []).map((u) => u.split("?")[0]!),
  );
  const candidates = (
    await discoverSourceCandidates({
      title: input.title,
      sourceUrl: input.sourceUrl,
      extraQueries: input.extraQueries,
      fast: input.fast,
      skipWebSearch: input.skipWebSearch,
    })
  ).filter((c) => !have.has(c.url.split("?")[0]!));

  const maxDeep = input.fast ? 4 : MAX_DEEP_SOURCES;
  const selected = candidates.slice(0, maxDeep + 2);
  const docs: SourceDocument[] = [];

  // Scrape par vagues parallèles : même budget temps, plus de matière.
  for (let i = 0; i < selected.length; i += SCRAPE_CONCURRENCY) {
    const wave = selected.slice(i, i + SCRAPE_CONCURRENCY);
    const results = await Promise.all(
      wave.map((c) => scrapeCandidate(c).catch(() => null)),
    );
    for (const doc of results) {
      if (doc) docs.push(doc);
    }
    if (docs.length >= maxDeep) break;
  }

  if (seed && !isCaptionSeed) {
    docs.unshift(
      enrichSourceWithTier({
        url: input.sourceUrl || "seed:sourceText",
        title: `Notes / texte source — ${input.title}`.slice(0, 160),
        publisher: "source fournie",
        language: "fr",
        retrievedAt: new Date().toISOString(),
        type: input.sourceUrl ? classifySourceType(input.sourceUrl) : "primary",
        scraped: true,
        confidence: 0,
        excerpt: seed.slice(0, MAX_EXCERPT),
        notes: "subject.sourceText",
      }),
    );
  }

  const byUrl = new Map<string, SourceDocument>();
  for (const s of docs) {
    const key = s.url.split("?")[0]!;
    const prev = byUrl.get(key);
    if (!prev || (!prev.scraped && s.scraped) || ((s.excerpt?.length || 0) > (prev.excerpt?.length || 0) && !prev.scraped)) {
      byUrl.set(key, enrichSourceWithTier(s));
    }
  }

  const entities = extractSubjectEntities(input.title);
  const docScore = (s: SourceDocument) =>
    relevanceScore(
      {
        title: s.title,
        url: s.url,
        snippet: (s.excerpt || "").slice(0, 1500),
        publisher: s.publisher,
        discoveredVia: s.notes || "",
      },
      input.title,
      entities,
    ) +
    rankingScoreFromTier(estimateSourceTier(s)) * 1.5;

  const ranked = [...byUrl.values()].sort((a, b) => {
    // Scrapés d'abord (matière réelle), puis pertinence + tier
    if (a.scraped !== b.scraped) return a.scraped ? -1 : 1;
    return docScore(b) - docScore(a);
  });

  return {
    sources: ranked.slice(0, maxDeep + 1),
    seedNotes: undefined,
  };
}

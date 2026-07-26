/**
 * Veille Google News FR — actu récente uniquement + sujets trigger droite.
 */

export type VeilleHit = {
  title: string;
  link?: string;
  source?: string;
  published?: string;
  publishedAt?: Date;
};

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const VEILLE_QUERIES = [
  "when:1d immigration France",
  "when:1d insécurité France",
  "when:1d violence police France",
  "when:1d émeutes France",
  "when:1d fiscalité France",
  "when:1d Assemblée nationale",
  "when:1d ministre polémique France",
  "when:1d justice France",
  "when:1d incendies France",
  "when:1d aide sociale France",
];

/** Max âge d'une brève (heures). */
const MAX_AGE_HOURS = 36;

function parsePubDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isFresh(publishedAt: Date | null): boolean {
  if (!publishedAt) return false;
  const ageMs = Date.now() - publishedAt.getTime();
  return ageMs >= 0 && ageMs <= MAX_AGE_HOURS * 60 * 60 * 1000;
}

/** Rejette les sujets sportifs / coupe du monde trop souvent recyclés. */
function looksStaleOrSports(title: string): boolean {
  const t = title.toLowerCase();
  if (/coupe du monde|world cup|qatar 2022|euro 20\d{2}/i.test(t)) return true;
  // Match foot ancien souvent recyclé hors calendrier
  if (
    /france[- ]maroc|maroc[- ]france/i.test(t) &&
    /interpell|supporter|stade|violences/i.test(t)
  ) {
    return true;
  }
  return false;
}

async function fetchGoogleNewsRss(query: string): Promise<VeilleHit[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "fr");
  url.searchParams.set("gl", "FR");
  url.searchParams.set("ceid", "FR:fr");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (+https://le-rempart.org; veille)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8);
  const hits: VeilleHit[] = [];

  for (const match of items) {
    const block = match[1];
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    if (!titleRaw) continue;
    const title = decodeXml(titleRaw).replace(/\s+[-–—]\s+[^-–—]+$/, "").trim();
    if (title.length < 20) continue;
    if (looksStaleOrSports(title)) continue;
    const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
    const source = decodeXml(
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "",
    );
    const published = decodeXml(
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "",
    );
    const publishedAt = parsePubDate(published);
    if (!isFresh(publishedAt)) continue;

    hits.push({
      title,
      link: link || undefined,
      source: source || undefined,
      published: published || undefined,
      publishedAt: publishedAt || undefined,
    });
  }
  return hits;
}

export async function scrapeHotNews(): Promise<VeilleHit[]> {
  const batches = await Promise.all(
    VEILLE_QUERIES.map(async (q) => {
      try {
        return await fetchGoogleNewsRss(q);
      } catch (err) {
        console.error("veille rss failed", q, err);
        return [] as VeilleHit[];
      }
    }),
  );

  const seen = new Set<string>();
  const out: VeilleHit[] = [];
  for (const hits of batches) {
    for (const hit of hits) {
      const key = hit.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
    }
  }

  // Plus récent d'abord
  out.sort(
    (a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0),
  );
  return out;
}

export function headlineKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 180);
}

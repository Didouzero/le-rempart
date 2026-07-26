/**
 * Veille Google News FR — sujets "chauds" / trigger droite Rempart.
 */

export type VeilleHit = {
  title: string;
  link?: string;
  source?: string;
  published?: string;
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
  "immigration France",
  "insécurité France",
  "émeutes France",
  "islamisme France",
  "fiscalité retraite France",
  "Assemblée nationale polémique",
  "ministre scandale France",
  "wokisme France",
  "aide sociale fraude France",
  "justice laxisme France",
];

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
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 6);
  const hits: VeilleHit[] = [];

  for (const match of items) {
    const block = match[1];
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    if (!titleRaw) continue;
    const title = decodeXml(titleRaw).replace(/\s+[-–—]\s+[^-–—]+$/, "").trim();
    if (title.length < 20) continue;
    const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
    const source = decodeXml(
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "",
    );
    const published = decodeXml(
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "",
    );
    hits.push({
      title,
      link: link || undefined,
      source: source || undefined,
      published: published || undefined,
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

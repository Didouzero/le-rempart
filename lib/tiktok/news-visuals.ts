/**
 * Visuels TikTok Droitocratie : photos / extraits d'actu, jamais de banque stock.
 * Ordre : article source → portraits Wiki → Commons → Google Images (Serper) → og:image Google News.
 */

import { extractPersonCandidates } from "@/lib/person-names";
import {
  findWikipediaPersonPhoto,
  findWikimediaCovers,
} from "@/lib/wikimedia";
import type { TiktokScene } from "@/lib/tiktok/types";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
  Referer: "https://www.google.fr/",
};

const STOCK_HOST =
  /pexels\.|pixabay\.|unsplash\.|shutterstock|istockphoto|stock\.adobe|freepik|dreamstime|depositphotos|123rf\.com|burst\.shopify|foap\.com|canva\.com|storyblocks|videezy|coverr\.co/i;

const SKIP_IMAGE =
  /logo|sprite|icon|avatar|emoji|pixel|1x1|blank|placeholder|wordpress\.svg|gravatar/i;

export type NewsVisual = { url: string; kind: "photo" | "video" };

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function isStockVisualHost(url: string): boolean {
  try {
    return STOCK_HOST.test(new URL(url).hostname);
  } catch {
    return STOCK_HOST.test(url);
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function absUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

function looksMediaUrl(url: string): "photo" | "video" | null {
  const lower = url.toLowerCase().split("?")[0] || url;
  if (/\.(mp4|mov|webm)$/i.test(lower)) return "video";
  if (/\.(jpe?g|png|webp|gif)$/i.test(lower)) return "photo";
  return null;
}

async function extractPageImages(pageUrl: string, limit = 8): Promise<string[]> {
  const res = await fetch(pageUrl, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const found: string[] = [];
  const push = (raw?: string | null) => {
    if (!raw) return;
    const href = absUrl(decodeEntities(raw.trim()), pageUrl);
    if (!href || !isHttpUrl(href) || isStockVisualHost(href)) return;
    if (SKIP_IMAGE.test(href) || href.startsWith("data:")) return;
    if (!found.includes(href)) found.push(href);
  };

  for (const re of [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)/gi,
  ]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) push(m[1]);
  }

  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    const w = Number(/\bwidth=["']?(\d+)/i.exec(tag)?.[1] || 0);
    const h = Number(/\bheight=["']?(\d+)/i.exec(tag)?.[1] || 0);
    if ((w && w < 120) || (h && h < 120)) continue;
    push(m[1]);
    if (found.length >= limit) break;
  }
  return found.slice(0, limit);
}

async function searchSerperImages(query: string, limit = 6): Promise<string[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return [];
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q, gl: "fr", hl: "fr", num: 10 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    images?: Array<{ imageUrl?: string; link?: string }>;
  };
  const out: string[] = [];
  for (const img of data.images || []) {
    const url = img.imageUrl || img.link;
    if (!url || !isHttpUrl(url) || isStockVisualHost(url)) continue;
    if (!out.includes(url)) out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

async function searchNewsOgImages(query: string, limit = 4): Promise<string[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const rss = new URL("https://news.google.com/rss/search");
  rss.searchParams.set("q", q);
  rss.searchParams.set("hl", "fr");
  rss.searchParams.set("gl", "FR");
  rss.searchParams.set("ceid", "FR:fr");
  const res = await fetch(rss, {
    headers: { "User-Agent": FETCH_HEADERS["User-Agent"]!, Accept: "application/rss+xml" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const links: string[] = [];
  const linkRe = /<link>([^<]+)<\/link>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(xml))) {
    const href = m[1].trim();
    if (!isHttpUrl(href) || /news\.google\./i.test(href)) continue;
    if (!links.includes(href)) links.push(href);
    if (links.length >= 5) break;
  }
  const out: string[] = [];
  for (const article of links.slice(0, 5)) {
    try {
      const imgs = await extractPageImages(article, 2);
      for (const img of imgs) {
        if (!out.includes(img)) out.push(img);
        if (out.length >= limit) return out;
      }
    } catch {
      // article bloqué
    }
  }
  return out;
}

function sceneQueries(scenes: TiktokScene[], title: string): string[] {
  const out: string[] = [];
  const push = (q: string) => {
    const t = q.replace(/\s+/g, " ").trim();
    if (t.length < 3) return;
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  for (const scene of scenes) {
    if (scene.person) push(scene.person);
    push(scene.visualQuery);
  }
  for (const person of extractPersonCandidates(`${title} ${scenes.map((s) => s.text).join(" ")}`)) {
    push(person);
  }
  return out.slice(0, 10);
}

export async function collectNewsVisuals(input: {
  sourceUrl: string;
  title: string;
  scenes: TiktokScene[];
  limit: number;
}): Promise<NewsVisual[]> {
  const seen = new Set<string>();
  const visuals: NewsVisual[] = [];
  const add = (url: string, kind: "photo" | "video" = "photo") => {
    const key = url.split("?")[0]!.toLowerCase();
    if (seen.has(key) || isStockVisualHost(url) || !isHttpUrl(url)) return;
    seen.add(key);
    visuals.push({ url, kind: looksMediaUrl(url) || kind });
  };

  try {
    for (const url of await extractPageImages(input.sourceUrl, 8)) add(url);
  } catch (err) {
    console.error("tiktok source images", err);
  }

  const queries = sceneQueries(input.scenes, input.title);
  const people = [
    ...new Set(
      [
        ...input.scenes.map((s) => s.person?.trim() || ""),
        ...extractPersonCandidates(input.title),
      ].filter((p) => p.length >= 4),
    ),
  ].slice(0, 6);

  await Promise.all(
    people.map(async (person) => {
      try {
        const [portrait, commons] = await Promise.all([
          findWikipediaPersonPhoto(person),
          findWikimediaCovers(person, 4),
        ]);
        if (portrait?.url) add(portrait.url);
        for (const cover of commons) add(cover.url);
      } catch (err) {
        console.error("tiktok person visuals", person, err);
      }
    }),
  );

  await Promise.all(
    queries.slice(0, 6).map(async (q) => {
      try {
        const [commons, serper] = await Promise.all([
          findWikimediaCovers(q, 3),
          searchSerperImages(q, 5),
        ]);
        for (const cover of commons) add(cover.url);
        for (const url of serper) add(url);
      } catch (err) {
        console.error("tiktok query visuals", q, err);
      }
    }),
  );

  if (visuals.length < Math.min(8, input.limit)) {
    await Promise.all(
      queries.slice(0, 2).map(async (q) => {
        try {
          for (const url of await searchNewsOgImages(q, 3)) add(url);
        } catch (err) {
          console.error("tiktok news og", q, err);
        }
      }),
    );
  }

  return visuals.slice(0, input.limit);
}

/**
 * Fond créative 1080×1440 : scène thématique choc d'abord, portrait perso ensuite.
 * Toute image est normalisée en JPEG (évite AVIF/WebP/HTML → "unsupported image format").
 */

import sharp from "sharp";
import { extractPersonCandidates } from "@/lib/person-names";
import { findOpenverseCoverUrls } from "@/lib/openverse";
import {
  fallbackVisualQueries,
  isVisualQueryCredible,
} from "@/lib/visual-queries";

async function fetchRawBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LeRempartBot/1.0 (+https://le-rempart.org; creatives)",
        Accept: "image/jpeg,image/png,image/webp,image/*,*/*",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1_000) return null;
    // HTML / JSON d'erreur
    const head = buf.subarray(0, 32).toString("utf8").toLowerCase();
    if (
      head.includes("<!doctype") ||
      head.includes("<html") ||
      head.startsWith("{") ||
      head.startsWith("<?xml")
    ) {
      return null;
    }
    return buf;
  } catch (err) {
    console.error("fetchRawBuffer failed", url, err);
    return null;
  }
}

/** Décode n'importe quel format supporté → JPEG RGB stable pour Sharp/Resvg. */
async function toJpegBuffer(buffer: Buffer): Promise<Buffer | null> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    if (!meta.format || meta.format === "svg" || meta.format === "pdf") {
      return null;
    }
    return await sharp(buffer, { failOn: "none" })
      .rotate()
      .removeAlpha()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error("toJpegBuffer failed", err);
    return null;
  }
}

async function fetchImageJpeg(url: string): Promise<Buffer | null> {
  const raw = await fetchRawBuffer(url);
  if (!raw) return null;
  return toJpegBuffer(raw);
}

/** Rejette les fonds blancs / graphiques type "AU MAROC" (trop clairs / plats). */
async function looksLikePhoto(jpegBuffer: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(jpegBuffer)
      .resize(64, 64, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    let dark = 0;
    let bright = 0;
    const n = info.width * info.height;
    for (let i = 0; i < data.length; i += 3) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += lum;
      if (lum < 80) dark += 1;
      if (lum > 220) bright += 1;
    }
    const avg = sum / n;
    if (avg > 200 && bright / n > 0.55) return false;
    if (dark / n < 0.02 && bright / n > 0.7) return false;
    return jpegBuffer.length > 8_000;
  } catch {
    return false;
  }
}

async function findPortraitPersonUrl(person: string): Promise<string | null> {
  try {
    const { findWikipediaCover } = await import("@/lib/wikimedia");
    const wiki = await findWikipediaCover(person);
    if (wiki?.url) return wiki.url;
  } catch (err) {
    console.error("wiki portrait failed", person, err);
  }

  for (const q of [`${person}`, `${person} portrait`, `${person} france`]) {
    try {
      const urls = await findOpenverseCoverUrls(q, {
        landscapeOnly: false,
        person,
        limit: 5,
      });
      if (urls[0]) return urls[0];
    } catch {
      // continue
    }
  }

  try {
    const { findWikimediaCover } = await import("@/lib/wikimedia");
    const commons = await findWikimediaCover(person);
    if (commons?.url) return commons.url;
  } catch {
    // ignore
  }

  return null;
}

async function tryQuery(
  q: string,
  topic?: string,
): Promise<{ buffer: Buffer; sourceUrl: string } | null> {
  try {
    const urls = await findOpenverseCoverUrls(q, {
      landscapeOnly: false,
      limit: 8,
      topic,
    });
    for (const url of urls) {
      const buffer = await fetchImageJpeg(url);
      if (!buffer) continue;
      if (!(await looksLikePhoto(buffer))) continue;
      return { buffer, sourceUrl: url };
    }
    return null;
  } catch {
    return null;
  }
}

/** Fond unicolore de secours (évite de planter le créneau). */
async function solidFallbackBackground(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1080,
      height: 1440,
      channels: 3,
      background: { r: 28, g: 24, b: 22 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function fetchCreativeBackground(input: {
  title: string;
  visualQuery?: string;
}): Promise<{ buffer: Buffer; sourceUrl: string | null }> {
  const thematic = fallbackVisualQueries(input.title);
  const kimiQ = input.visualQuery?.trim();
  // Kimi d'abord SEULEMENT si la requête colle au sujet (sinon textures / livres)
  const queries = [
    kimiQ && isVisualQueryCredible(kimiQ, input.title) ? kimiQ : null,
    ...thematic,
  ].filter((q): q is string => Boolean(q && q.length >= 6));

  // 1) Scènes thématiques (police / feux / etc.)
  for (const q of queries) {
    const hit = await tryQuery(q, input.title);
    if (hit) return hit;
  }

  // 2) Portrait personnalité
  const people = extractPersonCandidates(input.title);
  for (const person of people) {
    const url = await findPortraitPersonUrl(person);
    if (!url) continue;
    const buffer = await fetchImageJpeg(url);
    if (buffer && (await looksLikePhoto(buffer))) {
      return { buffer, sourceUrl: url };
    }
  }

  // 3) Filets
  for (const q of [
    "wildfire forest fire night france",
    "forest fire flames night europe",
    "riot police france night",
    "paris street protest night",
  ]) {
    const hit = await tryQuery(q, input.title);
    if (hit) return hit;
  }

  console.error(
    "fetchCreativeBackground: no usable photo, using solid fallback",
    input.title.slice(0, 80),
  );
  return { buffer: await solidFallbackBackground(), sourceUrl: null };
}

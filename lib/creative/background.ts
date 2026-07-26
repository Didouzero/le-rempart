/**
 * Fond créative 1080×1440 : scène thématique choc d'abord, portrait perso ensuite.
 */

import sharp from "sharp";
import { extractPersonCandidates } from "@/lib/person-names";
import { findOpenverseCoverUrl } from "@/lib/openverse";
import { fallbackVisualQueries } from "@/lib/visual-queries";

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LeRempartBot/1.0 (+https://le-rempart.org; creatives)",
        Accept: "image/*,*/*",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("fetchImageBuffer failed", url, err);
    return null;
  }
}

/** Rejette les fonds blancs / graphiques type "AU MAROC" (trop clairs / plats). */
async function looksLikePhoto(buffer: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(buffer)
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
    // Trop blanc / plat = probablement un graphic avec texte
    if (avg > 200 && bright / n > 0.55) return false;
    // Un peu de contraste attendu sur une vraie photo
    if (dark / n < 0.02 && bright / n > 0.7) return false;
    return buffer.length > 12_000;
  } catch {
    return buffer.length > 20_000;
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
      const url = await findOpenverseCoverUrl(q, {
        landscapeOnly: false,
        person,
      });
      if (url) return url;
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
): Promise<{ buffer: Buffer; sourceUrl: string } | null> {
  try {
    const url = await findOpenverseCoverUrl(q, { landscapeOnly: false });
    if (!url) return null;
    const buffer = await fetchImageBuffer(url);
    if (!buffer) return null;
    if (!(await looksLikePhoto(buffer))) return null;
    return { buffer, sourceUrl: url };
  } catch {
    return null;
  }
}

export async function fetchCreativeBackground(input: {
  title: string;
  visualQuery?: string;
}): Promise<{ buffer: Buffer; sourceUrl: string | null }> {
  const queries = [
    input.visualQuery?.trim(),
    ...fallbackVisualQueries(input.title),
  ].filter((q): q is string => Boolean(q && q.length >= 6));

  // 1) Scènes thématiques (priorité — photos réalistes / choc)
  for (const q of queries) {
    const hit = await tryQuery(q);
    if (hit) return hit;
  }

  // 2) Portrait personnalité seulement si présent dans le titre
  const people = extractPersonCandidates(input.title);
  for (const person of people) {
    const url = await findPortraitPersonUrl(person);
    if (!url) continue;
    const buffer = await fetchImageBuffer(url);
    if (buffer && (await looksLikePhoto(buffer))) {
      return { buffer, sourceUrl: url };
    }
  }

  // 3) Derniers filets
  for (const q of [
    "riot police france night",
    "paris street protest night",
    "french gendarmerie street",
  ]) {
    const hit = await tryQuery(q);
    if (hit) return hit;
  }

  throw new Error("Impossible de trouver une image de fond pour la créative");
}

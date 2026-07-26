/**
 * Fond créative 1080×1440 : portrait HQ (personnalité) ou scène.
 */

import { extractPersonCandidates } from "@/lib/person-names";
import { findOpenverseCoverUrl } from "@/lib/openverse";

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

async function findPortraitPersonUrl(person: string): Promise<string | null> {
  // Wikipedia (souvent portrait — OK pour créative 9:16)
  try {
    const { findWikipediaCover } = await import("@/lib/wikimedia");
    const wiki = await findWikipediaCover(person);
    if (wiki?.url) return wiki.url;
  } catch (err) {
    console.error("wiki portrait failed", person, err);
  }

  // Openverse sans contrainte paysage
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

export async function fetchCreativeBackground(input: {
  title: string;
}): Promise<{ buffer: Buffer; sourceUrl: string | null }> {
  const people = extractPersonCandidates(input.title);

  for (const person of people) {
    const url = await findPortraitPersonUrl(person);
    if (!url) continue;
    const buffer = await fetchImageBuffer(url);
    if (buffer && buffer.length > 8_000) {
      return { buffer, sourceUrl: url };
    }
  }

  // Fallback thématique
  const fallbackQueries = [
    "france politics demonstration",
    "french parliament hemicycle",
    "paris france night",
  ];
  for (const q of fallbackQueries) {
    try {
      const url = await findOpenverseCoverUrl(q, { landscapeOnly: false });
      if (!url) continue;
      const buffer = await fetchImageBuffer(url);
      if (buffer && buffer.length > 8_000) {
        return { buffer, sourceUrl: url };
      }
    } catch {
      // continue
    }
  }

  throw new Error("Impossible de trouver une image de fond pour la créative");
}

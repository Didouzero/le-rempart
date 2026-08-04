/**
 * Pexels — grosse banque gratuite.
 * Clé : https://www.pexels.com/api/ → PEXELS_API_KEY
 */

export async function findPexelsCoverUrls(
  query: string,
  opts?: { limit?: number; exclude?: Set<string> },
): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];

  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const limit = Math.max(1, Math.min(opts?.limit ?? 8, 20));

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", q);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");
  url.searchParams.set("per_page", String(Math.min(20, limit + 6)));
  url.searchParams.set("page", String(1 + Math.floor(Math.random() * 3)));

  const res = await fetch(url, {
    headers: { Authorization: key, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error("Pexels error", res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as {
    photos?: Array<{
      width?: number;
      height?: number;
      src?: { large2x?: string; large?: string; original?: string; medium?: string };
    }>;
  };

  const exclude = opts?.exclude;
  const out: Array<{ u: string; area: number }> = [];
  for (const photo of data.photos || []) {
    const u =
      photo.src?.large2x ||
      photo.src?.large ||
      photo.src?.original ||
      photo.src?.medium;
    if (!u || !/^https?:\/\//.test(u)) continue;
    if (exclude?.has(u)) continue;
    out.push({
      u,
      area: (photo.width || 1600) * (photo.height || 900),
    });
  }
  out.sort((a, b) => b.area - a.area);
  // Léger mélange du top
  const top = out.slice(0, Math.min(out.length, limit + 3));
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  return top.slice(0, limit).map((x) => x.u);
}

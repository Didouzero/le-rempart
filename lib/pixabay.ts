/**
 * Pixabay — grosse banque gratuite.
 * Clé : https://pixabay.com/api/docs/ → PIXABAY_API_KEY
 */

export async function findPixabayCoverUrls(
  query: string,
  opts?: { limit?: number; exclude?: Set<string> },
): Promise<string[]> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key) return [];

  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const limit = Math.max(1, Math.min(opts?.limit ?? 8, 20));

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", q);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", String(Math.min(30, Math.max(15, limit + 10))));
  url.searchParams.set("page", String(1 + Math.floor(Math.random() * 3)));
  url.searchParams.set("min_width", "1000");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error("Pixabay error", res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as {
    hits?: Array<{
      largeImageURL?: string;
      fullHDURL?: string;
      webformatURL?: string;
      imageWidth?: number;
      imageHeight?: number;
    }>;
  };

  const exclude = opts?.exclude;
  const out: Array<{ u: string; area: number }> = [];
  for (const hit of data.hits || []) {
    const u = hit.fullHDURL || hit.largeImageURL || hit.webformatURL;
    if (!u || !/^https?:\/\//.test(u)) continue;
    if (exclude?.has(u)) continue;
    out.push({
      u,
      area: (hit.imageWidth || 1200) * (hit.imageHeight || 800),
    });
  }
  out.sort((a, b) => b.area - a.area);
  const top = out.slice(0, Math.min(out.length, limit + 3));
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  return top.slice(0, limit).map((x) => x.u);
}

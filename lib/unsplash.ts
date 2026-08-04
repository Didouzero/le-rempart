/**
 * Illustration libre via Unsplash (évite Google Images / droits).
 * Nécessite UNSPLASH_ACCESS_KEY — gratuit sur https://unsplash.com/oauth/applications
 */

export async function findUnsplashCoverUrls(
  query: string,
  opts?: { limit?: number; exclude?: Set<string> },
): Promise<string[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];

  const q = query.trim().slice(0, 100) || "news";
  const limit = Math.max(1, Math.min(opts?.limit ?? 6, 15));
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", q);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", String(Math.min(15, limit + 4)));
  url.searchParams.set("content_filter", "high");
  // Varie un peu les pages pour éviter le même hit #1
  url.searchParams.set("page", String(1 + Math.floor(Math.random() * 3)));

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error("Unsplash error", res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as {
    results?: Array<{
      urls?: { regular?: string; full?: string; raw?: string };
      width?: number;
      height?: number;
    }>;
  };

  const exclude = opts?.exclude;
  const scored = (data.results || [])
    .map((photo) => {
      const u = photo.urls?.regular || photo.urls?.full || photo.urls?.raw;
      if (!u) return null;
      if (exclude?.has(u)) return null;
      const area = (photo.width || 0) * (photo.height || 0);
      return { u, area };
    })
    .filter((x): x is { u: string; area: number } => Boolean(x))
    .sort((a, b) => b.area - a.area);

  // Mélange léger parmi les meilleures pour casser les répétitions
  const top = scored.slice(0, Math.min(scored.length, limit + 3));
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  return top.slice(0, limit).map((x) => x.u);
}

export async function findUnsplashCoverUrl(query: string): Promise<string | null> {
  const urls = await findUnsplashCoverUrls(query, { limit: 1 });
  return urls[0] || null;
}

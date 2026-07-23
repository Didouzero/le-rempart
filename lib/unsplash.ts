/**
 * Illustration libre via Unsplash (évite Google Images / droits).
 * Nécessite UNSPLASH_ACCESS_KEY — gratuit sur https://unsplash.com/oauth/applications
 */
export async function findUnsplashCoverUrl(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const q = query.trim().slice(0, 100) || "news";
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", q);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", "1");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error("Unsplash error", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<{ urls?: { regular?: string; full?: string } }>;
  };
  const photo = data.results?.[0];
  return photo?.urls?.regular || photo?.urls?.full || null;
}

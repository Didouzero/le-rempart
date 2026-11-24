import { waitUntil } from "@vercel/functions";
import { siteUrlBase } from "@/lib/article-url";

/**
 * IndexNow : prévient Bing (et Yandex, Seznam, Naver…) qu'une page est nouvelle ou
 * modifiée, pour une indexation en quelques minutes. Bing alimente aussi ChatGPT Search
 * et Copilot. Google n'utilise pas IndexNow : il passe par les sitemaps.
 * La clé est publique par construction : le fichier public/<clé>.txt prouve qu'on possède le site.
 */
export const INDEXNOW_KEY = "2752bb9e41ddf746190358170bfcc7f0";

// Une même adresse n'est signalée qu'une fois toutes les 10 minutes par instance.
const recent = new Map<string, number>();
const COOLDOWN_MS = 10 * 60 * 1000;

export function notifyIndexNow(paths: string[]): void {
  if (process.env.VERCEL_ENV !== "production") return;
  const base = siteUrlBase().replace(/\/$/, "");
  const now = Date.now();
  const urlList = paths
    .map((p) => `${base}${p}`)
    .filter((url) => now - (recent.get(url) ?? 0) > COOLDOWN_MS);
  if (urlList.length === 0) return;
  for (const url of urlList) recent.set(url, now);

  const request = fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(base).host,
      key: INDEXNOW_KEY,
      keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
    signal: AbortSignal.timeout(10_000),
  })
    .then((res) => {
      if (!res.ok && res.status !== 202) console.warn("indexnow", res.status);
    })
    .catch((err) => console.warn("indexnow", err));

  try {
    waitUntil(request);
  } catch {
    // Hors requête Vercel : la promesse vit sa vie.
  }
}

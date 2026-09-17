import { findPexelsCoverUrls } from "@/lib/pexels";
import { findPixabayCoverUrls } from "@/lib/pixabay";
import { tiktokModels } from "@/lib/tiktok/db";
import { telegramDownloadFile } from "@/lib/telegram";
import { absoluteUrl } from "@/lib/seo";
import type {
  TiktokExtraMedia,
  TiktokScene,
  TiktokTimelineClip,
} from "@/lib/tiktok/types";
import { findWikipediaPersonPhoto, findWikimediaCover } from "@/lib/wikimedia";

const USER_MEDIA_MAX_BYTES = 14 * 1024 * 1024;

export type HostedAsset = {
  id: string;
  kind: string;
  mime: string;
};

export function tiktokAssetPublicUrl(assetId: string, fileToken: string): string {
  return absoluteUrl(`/api/tiktok/files/${assetId}?t=${fileToken}&kind=asset`);
}

export function tiktokRenderPublicUrl(jobId: string, fileToken: string): string {
  return absoluteUrl(`/api/tiktok/files/${jobId}?t=${fileToken}&kind=render`);
}

export function tiktokWordmarkUrl(): string {
  return absoluteUrl("/droitocratie/wordmark.svg");
}

async function findPexelsVideos(query: string, limit = 4): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return [];
  const q = query.trim().slice(0, 80);
  if (!q) return [];

  const search = async (orientation: "portrait" | "landscape") => {
    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.set("query", q);
    url.searchParams.set("orientation", orientation);
    url.searchParams.set("per_page", "8");
    url.searchParams.set("size", "medium");
    const res = await fetch(url, {
      headers: { Authorization: key, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      videos?: Array<{
        video_files?: Array<{
          link?: string;
          width?: number;
          height?: number;
          quality?: string;
          file_type?: string;
        }>;
      }>;
    };
    const out: string[] = [];
    for (const video of data.videos || []) {
      const files = [...(video.video_files || [])].sort((a, b) => {
        const aw = a.width || 0;
        const bw = b.width || 0;
        return Math.abs(720 - bw) - Math.abs(720 - aw);
      });
      const pick =
        files.find(
          (f) =>
            (f.file_type || "").includes("mp4") &&
            (f.width || 0) >= 480 &&
            (f.width || 0) <= 1920,
        ) || files[0];
      if (pick?.link && /^https?:\/\//.test(pick.link)) out.push(pick.link);
    }
    return out;
  };

  const portrait = await search("portrait").catch(() => [] as string[]);
  if (portrait.length >= limit) return portrait.slice(0, limit);
  const landscape = await search("landscape").catch(() => [] as string[]);
  return [...portrait, ...landscape].slice(0, limit);
}

async function findPixabayVideos(query: string, limit = 3): Promise<string[]> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key) return [];
  const q = query.trim().slice(0, 80);
  if (!q) return [];
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", q);
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "10");
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    hits?: Array<{
      videos?: {
        large?: { url?: string };
        medium?: { url?: string };
        small?: { url?: string };
      };
    }>;
  };
  const out: string[] = [];
  for (const hit of data.hits || []) {
    const u =
      hit.videos?.medium?.url ||
      hit.videos?.small?.url ||
      hit.videos?.large?.url;
    if (u && /^https?:\/\//.test(u)) out.push(u);
  }
  return out.slice(0, limit);
}

async function findStockPhoto(query: string, exclude: Set<string>): Promise<string | null> {
  const pexels = await findPexelsCoverUrls(query, { limit: 4, exclude });
  if (pexels[0]) return pexels[0];
  const pixabay = await findPixabayCoverUrls(query, { limit: 4, exclude });
  if (pixabay[0]) return pixabay[0];
  const wiki = await findWikimediaCover(query).catch(() => null);
  if (wiki?.url && !exclude.has(wiki.url)) return wiki.url;
  return null;
}

export async function findNewsMusicUrl(): Promise<string | null> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (key) {
    try {
      const url = new URL("https://pixabay.com/api/");
      url.searchParams.set("key", key);
      url.searchParams.set("q", "news documentary cinematic");
      url.searchParams.set("audio_type", "music");
      url.searchParams.set("per_page", "10");
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          hits?: Array<{ audioURL?: string; previewURL?: string }>;
        };
        const hit = data.hits?.find(
          (h) => h.audioURL || h.previewURL,
        );
        const u = hit?.audioURL || hit?.previewURL;
        if (u && /^https?:\/\//.test(u)) return u;
      }
    } catch (err) {
      console.error("pixabay music", err);
    }
  }

  try {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("origin", "*");
    searchUrl.searchParams.set("generator", "search");
    searchUrl.searchParams.set("gsrsearch", "news sting filetype:ogg");
    searchUrl.searchParams.set("gsrnamespace", "6");
    searchUrl.searchParams.set("gsrlimit", "5");
    searchUrl.searchParams.set("prop", "imageinfo");
    searchUrl.searchParams.set("iiprop", "url|mime");
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "DroitocratieBot/1.0 (https://le-rempart.org; news)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            { imageinfo?: Array<{ url?: string; mime?: string }> }
          >;
        };
      };
      for (const page of Object.values(data.query?.pages || {})) {
        const info = page.imageinfo?.[0];
        if (info?.url && info.mime?.startsWith("audio/")) return info.url;
      }
    }
  } catch (err) {
    console.error("wikimedia music", err);
  }

  return null;
}

async function hostTelegramFile(input: {
  jobId: string;
  fileId: string;
  kind: "photo" | "video";
}): Promise<HostedAsset> {
  const { buffer, mime } = await telegramDownloadFile(input.fileId);
  if (buffer.length > USER_MEDIA_MAX_BYTES) {
    throw new Error(
      `Fichier trop lourd (${Math.round(buffer.length / 1024 / 1024)} Mo). Max ~14 Mo.`,
    );
  }
  const row = await tiktokModels().asset.create({
    data: {
      jobId: input.jobId,
      kind: input.kind,
      mime: mime || (input.kind === "video" ? "video/mp4" : "image/jpeg"),
      data: new Uint8Array(buffer),
    },
  });
  return { id: row.id, kind: row.kind, mime: row.mime };
}

async function hostRemoteUrl(input: {
  jobId: string;
  url: string;
}): Promise<TiktokTimelineClip | null> {
  if (!/^https?:\/\//i.test(input.url)) return null;
  const lower = input.url.toLowerCase();
  const looksVideo = /\.(mp4|mov|webm)(\?|$)/i.test(lower);
  const looksPhoto = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(lower);
  if (looksVideo) {
    return { source: input.url, kind: "video", duration: 0 };
  }
  if (looksPhoto) {
    return { source: input.url, kind: "photo", duration: 0 };
  }
  try {
    const res = await fetch(input.url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    const mime = res.headers.get("content-type") || "";
    if (mime.startsWith("video/")) {
      return { source: input.url, kind: "video", duration: 0 };
    }
    if (mime.startsWith("image/")) {
      return { source: input.url, kind: "photo", duration: 0 };
    }
  } catch {
    // treat as photo URL for Creatomate
  }
  return { source: input.url, kind: "photo", duration: 0 };
}

export async function saveVoiceAsset(input: {
  jobId: string;
  audio: Buffer;
  mime: string;
}): Promise<HostedAsset> {
  const row = await tiktokModels().asset.create({
    data: {
      jobId: input.jobId,
      kind: "audio",
      mime: input.mime,
      data: new Uint8Array(input.audio),
    },
  });
  return { id: row.id, kind: row.kind, mime: row.mime };
}

export async function buildTimelineClips(input: {
  jobId: string;
  fileToken: string;
  extraMedia: TiktokExtraMedia[];
  scenes: TiktokScene[];
  durationSec: number;
}): Promise<TiktokTimelineClip[]> {
  const clips: TiktokTimelineClip[] = [];
  const exclude = new Set<string>();

  for (const media of input.extraMedia) {
    try {
      if (media.fileId) {
        const hosted = await hostTelegramFile({
          jobId: input.jobId,
          fileId: media.fileId,
          kind: media.kind === "video" ? "video" : "photo",
        });
        clips.push({
          source: tiktokAssetPublicUrl(hosted.id, input.fileToken),
          kind: hosted.kind === "video" ? "video" : "photo",
          duration: 0,
        });
      } else if (media.url) {
        const remote = await hostRemoteUrl({
          jobId: input.jobId,
          url: media.url,
        });
        if (remote) {
          clips.push(remote);
          exclude.add(remote.source);
        }
      }
    } catch (err) {
      console.error("tiktok user media skipped", err);
    }
  }

  for (const scene of input.scenes) {
    if (clips.length >= 12) break;
    if (scene.person) {
      const portrait = await findWikipediaPersonPhoto(scene.person).catch(
        () => null,
      );
      if (portrait?.url && !exclude.has(portrait.url)) {
        exclude.add(portrait.url);
        clips.push({ source: portrait.url, kind: "photo", duration: 0 });
        continue;
      }
    }
    if (scene.kind !== "photo") {
      const videos = [
        ...(await findPexelsVideos(scene.visualQuery, 2).catch(() => [])),
        ...(await findPixabayVideos(scene.visualQuery, 1).catch(() => [])),
      ];
      const pick = videos.find((u) => !exclude.has(u));
      if (pick) {
        exclude.add(pick);
        clips.push({ source: pick, kind: "video", duration: 0 });
        continue;
      }
    }
    const photo = await findStockPhoto(scene.visualQuery, exclude);
    if (photo) {
      exclude.add(photo);
      clips.push({ source: photo, kind: "photo", duration: 0 });
    }
  }

  if (clips.length === 0) {
    const fallback =
      (await findPexelsVideos("france news paris", 3).catch(() => []))[0] ||
      (await findStockPhoto("france paris government", exclude));
    if (!fallback) {
      throw new Error(
        "Aucun visuel trouvé (Pexels/Pixabay). Ajoute une photo ou une vidéo, ou vérifie PEXELS_API_KEY.",
      );
    }
    clips.push({
      source: fallback,
      kind: fallback.match(/\.(mp4|mov|webm)/i) ? "video" : "photo",
      duration: 0,
    });
  }

  const n = clips.length;
  const base = input.durationSec / n;
  return clips.map((c, i) => ({
    ...c,
    duration:
      i === n - 1
        ? Math.round((input.durationSec - base * (n - 1)) * 100) / 100
        : Math.round(base * 100) / 100,
  }));
}

import { tiktokModels } from "@/lib/tiktok/db";
import { telegramDownloadFile } from "@/lib/telegram";
import { absoluteUrl } from "@/lib/seo";
import type {
  TiktokExtraMedia,
  TiktokScene,
  TiktokTimelineClip,
} from "@/lib/tiktok/types";
import {
  TIKTOK_MAX_EXCERPT_SEC,
  TIKTOK_MIN_EXCERPT_SEC,
} from "@/lib/tiktok/types";
import {
  collectNewsVisuals,
  isStockVisualHost,
} from "@/lib/tiktok/news-visuals";

const USER_MEDIA_MAX_BYTES = 14 * 1024 * 1024;
const NEWS_INGEST_MAX_BYTES = 8 * 1024 * 1024;

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

export async function findNewsMusicUrl(): Promise<string | null> {
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

async function ingestRemoteVisual(input: {
  jobId: string;
  url: string;
  kind: "photo" | "video";
  fileToken: string;
}): Promise<TiktokTimelineClip | null> {
  if (!/^https?:\/\//i.test(input.url) || isStockVisualHost(input.url)) {
    return null;
  }
  try {
    const res = await fetch(input.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,video/mp4,*/*;q=0.8",
        Referer: "https://www.google.fr/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") || "").split(";")[0]!.trim();
    if (mime.includes("svg") || mime.includes("html")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 800 || buf.length > NEWS_INGEST_MAX_BYTES) return null;
    const kind =
      mime.startsWith("video/") || input.kind === "video" ? "video" : "photo";
    const row = await tiktokModels().asset.create({
      data: {
        jobId: input.jobId,
        kind,
        mime:
          mime ||
          (kind === "video" ? "video/mp4" : "image/jpeg"),
        data: new Uint8Array(buf),
      },
    });
    return {
      source: tiktokAssetPublicUrl(row.id, input.fileToken),
      kind,
      duration: 0,
    };
  } catch (err) {
    console.error("tiktok ingest visual", input.url.slice(0, 80), err);
    return null;
  }
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

function assignExcerptDurations(
  clips: TiktokTimelineClip[],
  durationSec: number,
): TiktokTimelineClip[] {
  const n = clips.length;
  if (n === 0) return clips;
  const base = durationSec / n;
  const each = Math.min(
    TIKTOK_MAX_EXCERPT_SEC,
    Math.max(TIKTOK_MIN_EXCERPT_SEC, Math.round(base * 100) / 100),
  );
  let used = 0;
  return clips.map((c, i) => {
    const duration =
      i === n - 1
        ? Math.round((durationSec - used) * 100) / 100
        : each;
    used += duration;
    return { ...c, duration };
  });
}

export async function buildTimelineClips(input: {
  jobId: string;
  fileToken: string;
  extraMedia: TiktokExtraMedia[];
  scenes: TiktokScene[];
  durationSec: number;
  sourceUrl: string;
  title: string;
}): Promise<TiktokTimelineClip[]> {
  const unique: TiktokTimelineClip[] = [];
  const seen = new Set<string>();

  const pushClip = (clip: TiktokTimelineClip | null) => {
    if (!clip?.source) return;
    const key = clip.source.split("?")[0]!.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(clip);
  };

  for (const media of input.extraMedia) {
    try {
      if (media.fileId) {
        const hosted = await hostTelegramFile({
          jobId: input.jobId,
          fileId: media.fileId,
          kind: media.kind === "video" ? "video" : "photo",
        });
        pushClip({
          source: tiktokAssetPublicUrl(hosted.id, input.fileToken),
          kind: hosted.kind === "video" ? "video" : "photo",
          duration: 0,
        });
      } else if (media.url && !isStockVisualHost(media.url)) {
        pushClip(
          await ingestRemoteVisual({
            jobId: input.jobId,
            url: media.url,
            kind: media.kind === "video" ? "video" : "photo",
            fileToken: input.fileToken,
          }),
        );
      }
    } catch (err) {
      console.error("tiktok user media skipped", err);
    }
  }

  const needed = Math.max(
    10,
    Math.ceil(input.durationSec / TIKTOK_MAX_EXCERPT_SEC),
  );
  const news = await collectNewsVisuals({
    sourceUrl: input.sourceUrl,
    title: input.title,
    scenes: input.scenes,
    limit: Math.max(needed + 4, 16),
  });
  const ingested = await Promise.all(
    news.slice(0, 18).map((visual) =>
      ingestRemoteVisual({
        jobId: input.jobId,
        url: visual.url,
        kind: visual.kind,
        fileToken: input.fileToken,
      }),
    ),
  );
  for (const clip of ingested) pushClip(clip);

  if (unique.length === 0) {
    throw new Error(
      "Aucun visuel d’actu. Envoie des photos ou extraits du sujet (les gens dont on parle) — on n’utilise pas de banque d’images.",
    );
  }

  const clips: TiktokTimelineClip[] = [];
  while (clips.length < needed) {
    clips.push(unique[clips.length % unique.length]!);
  }

  return assignExcerptDurations(clips, input.durationSec);
}

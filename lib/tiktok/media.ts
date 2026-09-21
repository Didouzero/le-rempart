import { tiktokModels } from "@/lib/tiktok/db";
import { telegramDownloadFile } from "@/lib/telegram";
import { absoluteUrl } from "@/lib/seo";
import type {
  TiktokExtraMedia,
  TiktokMontagePlan,
  TiktokScene,
  TiktokTimelineClip,
  TiktokVoiceSegment,
} from "@/lib/tiktok/types";
import {
  TIKTOK_MAX_DURATION_MS,
  TIKTOK_MAX_EXCERPT_SEC,
  TIKTOK_MAX_SOUNDBITE_TOTAL_SEC,
  TIKTOK_MAX_SOUNDBITES,
  TIKTOK_MIN_EXCERPT_SEC,
} from "@/lib/tiktok/types";
import {
  collectNewsVisuals,
  isStockVisualHost,
} from "@/lib/tiktok/news-visuals";
import { pickSmartExcerpts } from "@/lib/tiktok/smart-clips";

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
}): Promise<HostedAsset & { buffer: Buffer }> {
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
  return { id: row.id, kind: row.kind, mime: row.mime, buffer };
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

function fillBroll(
  pool: TiktokTimelineClip[],
  start: number,
  duration: number,
): TiktokTimelineClip[] {
  if (duration <= 0.08 || pool.length === 0) return [];
  const end = start + duration;
  const out: TiktokTimelineClip[] = [];
  let t = start;
  let i = 0;
  while (t < end - 0.05) {
    const left = end - t;
    const src = pool[i % pool.length]!;
    const piece =
      left < TIKTOK_MIN_EXCERPT_SEC + 0.4
        ? left
        : Math.min(TIKTOK_MAX_EXCERPT_SEC, left);
    out.push({
      ...src,
      time: Number(t.toFixed(2)),
      duration: Number(piece.toFixed(2)),
      role: "broll",
    });
    t += piece;
    i += 1;
  }
  return out;
}

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pickSoundbites(
  clips: TiktokTimelineClip[],
  title: string,
  scenes: TiktokScene[],
): TiktokTimelineClip[] {
  const hay = fold(
    `${title} ${scenes.map((s) => `${s.person || ""} ${s.text}`).join(" ")}`,
  );
  const bites = clips
    .filter((c) => c.role === "soundbite" && c.kind === "video")
    .map((c) => {
      const dur = clampBiteDuration(c.duration);
      const label = fold(c.label || "");
      const personHit = hay
        .split(/\s+/)
        .filter((w) => w.length >= 5)
        .some((w) => label.includes(w));
      const durationScore = 5 - Math.abs(dur - 4.5);
      const score = (personHit ? 8 : 0) + durationScore;
      return { clip: { ...c, duration: dur, role: "soundbite" as const }, score };
    })
    .sort((a, b) => b.score - a.score);

  const chosen: TiktokTimelineClip[] = [];
  let total = 0;
  for (const { clip } of bites) {
    if (chosen.length >= TIKTOK_MAX_SOUNDBITES) break;
    if (total + clip.duration > TIKTOK_MAX_SOUNDBITE_TOTAL_SEC) break;
    chosen.push(clip);
    total += clip.duration;
  }
  return chosen;
}

function orderBroll(clips: TiktokTimelineClip[]): TiktokTimelineClip[] {
  const photos = clips.filter((c) => c.kind === "photo");
  const videos = clips.filter((c) => c.kind === "video");
  const out: TiktokTimelineClip[] = [];
  const n = Math.max(photos.length, videos.length);
  for (let i = 0; i < n; i++) {
    if (photos[i]) out.push(photos[i]!);
    if (videos[i]) out.push(videos[i]!);
  }
  return out.length ? out : clips;
}

function clampBiteDuration(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return TIKTOK_MAX_EXCERPT_SEC;
  }
  return Math.min(
    TIKTOK_MAX_EXCERPT_SEC,
    Math.max(TIKTOK_MIN_EXCERPT_SEC, duration),
  );
}

function assembleMontage(
  voiceSec: number,
  clips: TiktokTimelineClip[],
  title: string,
  scenes: TiktokScene[],
): TiktokMontagePlan {
  const maxTotal = TIKTOK_MAX_DURATION_MS / 1000;
  let bites = pickSoundbites(clips, title, scenes);
  while (
    bites.length &&
    voiceSec + bites.reduce((s, b) => s + b.duration, 0) > maxTotal + 0.05
  ) {
    bites = bites.slice(0, -1);
  }

  const brollPool = clips.filter((c) => c.role !== "soundbite");
  const pool = orderBroll(brollPool.length ? brollPool : clips);

  const fractions =
    bites.length <= 1
      ? [0.38]
      : bites.length === 2
        ? [0.28, 0.62]
        : [0.22, 0.48, 0.72];
  const insertAt = bites.map((_, i) =>
    Number((voiceSec * (fractions[i] || 0.5)).toFixed(2)),
  );

  type Event =
    | { type: "vo"; duration: number }
    | { type: "bite"; clip: TiktokTimelineClip };
  const events: Event[] = [];
  let voPos = 0;
  bites.forEach((bite, i) => {
    const at = Math.min(insertAt[i] ?? voPos, voiceSec);
    if (at > voPos + 0.4) {
      events.push({ type: "vo", duration: Number((at - voPos).toFixed(2)) });
      voPos = at;
    }
    events.push({ type: "bite", clip: bite });
  });
  if (voiceSec - voPos > 0.4) {
    events.push({
      type: "vo",
      duration: Number((voiceSec - voPos).toFixed(2)),
    });
  }

  const visuals: TiktokTimelineClip[] = [];
  const voiceSegments: TiktokVoiceSegment[] = [];
  let t = 0;
  let voTrim = 0;
  for (const ev of events) {
    if (ev.type === "vo") {
      voiceSegments.push({
        time: Number(t.toFixed(2)),
        duration: ev.duration,
        trimStart: Number(voTrim.toFixed(2)),
      });
      visuals.push(...fillBroll(pool, t, ev.duration));
      voTrim += ev.duration;
      t += ev.duration;
    } else {
      visuals.push({
        ...ev.clip,
        time: Number(t.toFixed(2)),
        duration: ev.clip.duration,
        role: "soundbite",
      });
      t += ev.clip.duration;
    }
  }

  return {
    durationSec: Number(t.toFixed(2)),
    clips: visuals,
    voiceSegments,
    soundbiteCount: bites.length,
  };
}

export async function buildMontagePlan(input: {
  jobId: string;
  fileToken: string;
  extraMedia: TiktokExtraMedia[];
  scenes: TiktokScene[];
  durationSec: number;
  sourceUrl: string;
  title: string;
}): Promise<TiktokMontagePlan> {
  const unique: TiktokTimelineClip[] = [];
  const seen = new Set<string>();

  const pushClip = (clip: TiktokTimelineClip | null) => {
    if (!clip?.source) return;
    const key = `${clip.source.split("?")[0]}#${clip.trimStart ?? 0}#${clip.role || "broll"}`;
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
        const source = tiktokAssetPublicUrl(hosted.id, input.fileToken);
        if (hosted.kind === "video") {
          const excerpts = await pickSmartExcerpts({
            buffer: hosted.buffer,
            mime: hosted.mime,
            durationSec: media.durationSec,
            title: input.title,
            scenes: input.scenes,
          });
          for (const ex of excerpts) {
            pushClip({
              source,
              kind: "video",
              duration: ex.duration,
              trimStart: ex.start,
              role: ex.role,
              label: ex.why,
            });
          }
        } else {
          pushClip({
            source,
            kind: "photo",
            duration: 0,
            role: "broll",
          });
        }
      } else if (media.url && !isStockVisualHost(media.url)) {
        const remote = await ingestRemoteVisual({
          jobId: input.jobId,
          url: media.url,
          kind: media.kind === "video" ? "video" : "photo",
          fileToken: input.fileToken,
        });
        if (remote) pushClip({ ...remote, role: "broll" });
      }
    } catch (err) {
      console.error("tiktok user media skipped", err);
    }
  }

  if (unique.length === 0) {
    const needed = Math.ceil(input.durationSec / TIKTOK_MAX_EXCERPT_SEC);
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
    for (const clip of ingested) {
      if (clip) pushClip({ ...clip, role: "broll" });
    }
  }

  if (unique.length === 0) {
    throw new Error(
      "Aucun visuel. Envoie des extraits vidéo et des photos, puis /tiktok_go.",
    );
  }

  return assembleMontage(input.durationSec, unique, input.title, input.scenes);
}


import { absoluteUrl } from "@/lib/seo";
import {
  findNewsMusicUrl,
  tiktokWordmarkUrl,
} from "@/lib/tiktok/media";
import type { TiktokTimelineClip } from "@/lib/tiktok/types";

export function isCreatomateConfigured(): boolean {
  return Boolean(process.env.CREATOMATE_API_KEY?.trim());
}

function webhookUrl(): string {
  const secret =
    process.env.CREATOMATE_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  const base = absoluteUrl("/api/tiktok/render-webhook");
  return secret ? `${base}?secret=${encodeURIComponent(secret)}` : base;
}

function clipElements(
  clips: TiktokTimelineClip[],
): Array<Record<string, unknown>> {
  let t = 0;
  const out: Array<Record<string, unknown>> = [];
  for (const clip of clips) {
    const duration = Math.max(3, clip.duration);
    const el: Record<string, unknown> = {
      type: clip.kind === "video" ? "video" : "image",
      source: clip.source,
      track: 1,
      time: Number(t.toFixed(2)),
      duration,
      x: "50%",
      y: "50%",
      width: "100%",
      height: "100%",
      fit: "cover",
    };
    if (clip.kind === "photo") {
      el.animations = [
        {
          type: "scale",
          easing: "linear",
          start_scale: "100%",
          end_scale: "112%",
          fade: false,
        },
      ];
    } else {
      el.animations = [{ type: "fade", duration: 0.35, transition: true }];
    }
    out.push(el);
    t += duration;
  }
  return out;
}

export async function startCreatomateRender(input: {
  jobId: string;
  durationSec: number;
  voiceUrl: string;
  clips: TiktokTimelineClip[];
}): Promise<{ id: string }> {
  const apiKey = process.env.CREATOMATE_API_KEY?.trim();
  if (!apiKey) throw new Error("CREATOMATE_API_KEY n’est pas configurée.");

  const duration = Math.round(input.durationSec * 100) / 100;
  const musicUrl = await findNewsMusicUrl().catch(() => null);

  const elements: Array<Record<string, unknown>> = [
    ...clipElements(input.clips),
    {
      type: "shape",
      track: 2,
      time: 0,
      duration,
      x: "50%",
      y: "100%",
      width: "100%",
      height: "32%",
      fill_color: "rgba(0,0,0,0.55)",
    },
    {
      type: "image",
      source: tiktokWordmarkUrl(),
      track: 3,
      time: 0,
      duration,
      x: "8%",
      y: "6%",
      width: "42%",
      height: "7%",
      fit: "contain",
      x_anchor: "0%",
      y_anchor: "0%",
    },
    {
      type: "text",
      track: 3,
      time: 0,
      duration,
      text: "DROITOCRATIE",
      y: "11.5%",
      x: "8%",
      width: "70%",
      height: "4%",
      x_anchor: "0%",
      y_anchor: "0%",
      font_family: "Montserrat",
      font_weight: "800",
      font_size: "3.2 vmin",
      fill_color: "#d4af37",
      letter_spacing: "8%",
    },
    {
      id: "voiceover",
      type: "audio",
      source: input.voiceUrl,
      track: 4,
      time: 0,
      duration,
    },
    {
      type: "text",
      transcript_source: "voiceover",
      transcript_maximum_length: 4,
      transcript_color: "#d4af37",
      track: 5,
      time: 0,
      duration,
      y: "74%",
      width: "88%",
      height: "18%",
      font_family: "Montserrat",
      font_weight: "800",
      font_size: "7.2 vmin",
      fill_color: "#ffffff",
      stroke_color: "#000000",
      stroke_width: "1.6 vmin",
      line_height: "110%",
      text_align: "center",
    },
  ];

  if (musicUrl) {
    elements.push({
      type: "audio",
      source: musicUrl,
      track: 6,
      time: 0,
      duration,
      volume: "10%",
      audio_fade_out: 1.2,
    });
  }

  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30,
      duration,
      webhook_url: webhookUrl(),
      metadata: JSON.stringify({ jobId: input.jobId }),
      elements,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as
    | { id?: string; status?: string; error?: string; message?: string }
    | Array<{ id?: string; status?: string }>;

  if (!res.ok) {
    const msg =
      (!Array.isArray(data) && (data.error || data.message)) ||
      `Creatomate HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  const first = Array.isArray(data) ? data[0] : data;
  if (!first?.id) throw new Error("Creatomate : identifiant de rendu manquant");
  return { id: first.id };
}

export function parseCreatomateMetadata(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const obj = JSON.parse(raw) as { jobId?: string };
      return obj.jobId || null;
    } catch {
      return raw.length < 80 ? raw : null;
    }
  }
  if (typeof raw === "object" && raw && "jobId" in raw) {
    const id = (raw as { jobId?: unknown }).jobId;
    return typeof id === "string" ? id : null;
  }
  return null;
}

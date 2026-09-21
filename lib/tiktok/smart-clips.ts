/**
 * Découpe une vidéo longue en extraits parlants (ex. Hollande à 0:40).
 * 1) Transcription horodatée ElevenLabs Scribe
 * 2) Kimi choisit des fenêtres de 3–5 s collées au sujet
 * 3) Sinon, extraits répartis sur la durée (pas seulement 0:00)
 */

import { getKimiTextModel } from "@/lib/kimi-legacy";
import { moonshotChat } from "@/lib/moonshot";
import { extractPersonCandidates } from "@/lib/person-names";
import {
  TIKTOK_MAX_EXCERPT_SEC,
  TIKTOK_MIN_EXCERPT_SEC,
  type TiktokScene,
} from "@/lib/tiktok/types";

const SHORT_SEC = 8;
const MAX_EXCERPTS_PER_VIDEO = 5;

export type SmartExcerpt = {
  start: number;
  duration: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function spacedExcerpts(durationSec: number): SmartExcerpt[] {
  const span = TIKTOK_MAX_EXCERPT_SEC;
  if (durationSec <= SHORT_SEC) {
    return [{ start: 0, duration: Math.max(TIKTOK_MIN_EXCERPT_SEC, durationSec) }];
  }
  const usable = Math.max(0, durationSec - span);
  const n = Math.min(
    MAX_EXCERPTS_PER_VIDEO,
    Math.max(2, Math.floor(durationSec / 12)),
  );
  const out: SmartExcerpt[] = [];
  for (let i = 0; i < n; i++) {
    const start =
      n === 1 ? 0 : Math.round((i * usable) / (n - 1) * 10) / 10;
    out.push({ start, duration: span });
  }
  return out;
}

function mergeClose(excerpts: SmartExcerpt[], durationSec: number): SmartExcerpt[] {
  const sorted = [...excerpts].sort((a, b) => a.start - b.start);
  const out: SmartExcerpt[] = [];
  for (const ex of sorted) {
    const start = clamp(
      ex.start,
      0,
      Math.max(0, durationSec - TIKTOK_MIN_EXCERPT_SEC),
    );
    const duration = clamp(
      ex.duration || TIKTOK_MAX_EXCERPT_SEC,
      TIKTOK_MIN_EXCERPT_SEC,
      TIKTOK_MAX_EXCERPT_SEC,
    );
    const last = out[out.length - 1];
    if (last && Math.abs(start - last.start) < 3.2) continue;
    out.push({ start, duration });
    if (out.length >= MAX_EXCERPTS_PER_VIDEO) break;
  }
  return out;
}

type SttWord = { text: string; start: number; end: number };

async function transcribeVideo(input: {
  buffer: Buffer;
  mime: string;
}): Promise<{ words: SttWord[]; durationSec: number } | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;
  const form = new FormData();
  form.set("model_id", "scribe_v1");
  form.set("language_code", "fra");
  form.set("timestamps_granularity", "word");
  const ext = (input.mime || "").includes("webm") ? "webm" : "mp4";
  form.set(
    "file",
    new File([new Uint8Array(input.buffer)], `clip.${ext}`, {
      type: input.mime || "video/mp4",
    }),
  );
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.error("elevenlabs stt", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as {
    text?: string;
    words?: Array<{
      text?: string;
      start?: number;
      end?: number;
      type?: string;
    }>;
  };
  const words: SttWord[] = [];
  for (const w of data.words || []) {
    if (w.type && w.type !== "word") continue;
    const text = (w.text || "").trim();
    if (!text || typeof w.start !== "number") continue;
    words.push({
      text,
      start: w.start,
      end: typeof w.end === "number" ? w.end : w.start + 0.3,
    });
  }
  if (words.length < 6) return null;
  const durationSec = words[words.length - 1]!.end;
  return { words, durationSec };
}

function compactTranscript(words: SttWord[]): string {
  const lines: string[] = [];
  let bucket = 0;
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const m = Math.floor(bucket / 60);
    const s = Math.floor(bucket % 60);
    lines.push(
      `[${m}:${String(s).padStart(2, "0")}] ${buf.join(" ")}`,
    );
    buf = [];
  };
  for (const w of words) {
    const b = Math.floor(w.start / 2) * 2;
    if (b !== bucket && buf.length) {
      flush();
      bucket = b;
    }
    bucket = b;
    buf.push(w.text);
  }
  flush();
  return lines.join("\n").slice(0, 4500);
}

async function kimiPickExcerpts(input: {
  transcript: string;
  durationSec: number;
  title: string;
  scenes: TiktokScene[];
}): Promise<SmartExcerpt[]> {
  const people = [
    ...new Set(
      [
        ...input.scenes.map((s) => s.person || ""),
        ...extractPersonCandidates(input.title),
        ...input.scenes.flatMap((s) => extractPersonCandidates(s.text)),
      ]
        .map((p) => p.trim())
        .filter((p) => p.length >= 4),
    ),
  ].slice(0, 8);
  const raw = await moonshotChat({
    model: getKimiTextModel(),
    maxTokens: 500,
    timeoutMs: 25_000,
    reasoningEffort: "low",
    messages: [
      {
        role: "system",
        content: `Tu découpes un reportage pour un TikTok d'actu français. On veut des EXTRAITS parlants de ${TIKTOK_MIN_EXCERPT_SEC} à ${TIKTOK_MAX_EXCERPT_SEC} secondes, pas l'intro générique.
Réponds UNIQUEMENT JSON : {"clips":[{"start":40.2,"duration":4.8,"why":"Hollande parle"}]}
start = secondes depuis le début. 3 à ${MAX_EXCERPTS_PER_VIDEO} clips, non chevauchants, dans l'ordre chronologique. Priorité : personnalités citées qui PARLENT, phrases concrètes. Interdit : silence, générique, publicité.`,
      },
      {
        role: "user",
        content: [
          `Sujet : ${input.title}`,
          people.length ? `Gens à viser : ${people.join(", ")}` : "",
          `Durée source : ${Math.round(input.durationSec)} s`,
          "",
          "Transcript horodaté :",
          input.transcript,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  const obj = JSON.parse(raw.slice(start, end + 1)) as {
    clips?: Array<{ start?: unknown; duration?: unknown }>;
  };
  const clips: SmartExcerpt[] = [];
  for (const c of obj.clips || []) {
    const s = Number(c.start);
    if (!Number.isFinite(s)) continue;
    clips.push({
      start: s,
      duration: Number(c.duration) || TIKTOK_MAX_EXCERPT_SEC,
    });
  }
  return clips;
}

export function isLongVideo(durationSec?: number): boolean {
  return typeof durationSec === "number" && durationSec > SHORT_SEC;
}

export async function pickSmartExcerpts(input: {
  buffer: Buffer;
  mime: string;
  durationSec?: number;
  title: string;
  scenes: TiktokScene[];
}): Promise<SmartExcerpt[]> {
  const known = input.durationSec && input.durationSec > 0 ? input.durationSec : 0;
  if (known && known <= SHORT_SEC) {
    return [{ start: 0, duration: Math.max(known, TIKTOK_MIN_EXCERPT_SEC) }];
  }

  try {
    const stt = await transcribeVideo({ buffer: input.buffer, mime: input.mime });
    const durationSec = Math.max(known, stt?.durationSec || 0);
    if (stt && durationSec > SHORT_SEC) {
      const picked = await kimiPickExcerpts({
        transcript: compactTranscript(stt.words),
        durationSec,
        title: input.title,
        scenes: input.scenes,
      }).catch((err) => {
        console.error("tiktok kimi clips", err);
        return [] as SmartExcerpt[];
      });
      const merged = mergeClose(picked, durationSec);
      if (merged.length) return merged;
      return spacedExcerpts(durationSec);
    }
  } catch (err) {
    console.error("tiktok smart clips", err);
  }

  if (known > SHORT_SEC) return spacedExcerpts(known);
  return [{ start: 0, duration: TIKTOK_MAX_EXCERPT_SEC }];
}

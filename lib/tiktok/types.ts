export const TIKTOK_DRAFT_TTL_MS = 30 * 60 * 1000;

/** Cible Creator Rewards : strictement > 60 s, idéalement 1:02–1:20. */
export const TIKTOK_MIN_DURATION_MS = 62_000;
export const TIKTOK_MAX_DURATION_MS = 80_000;
export const TIKTOK_HARD_POST_MIN_MS = 60_001;

export const TIKTOK_SCRIPT_MIN_WORDS = 165;
export const TIKTOK_SCRIPT_MAX_WORDS = 200;
export const TIKTOK_SCRIPT_TARGET_WORDS = 180;

export const TIKTOK_TTS_MAX_ATTEMPTS = 3;

/** Extraît d'actu : quelques secondes par plan, jamais un plan stock de 10 s. */
export const TIKTOK_MAX_EXCERPT_SEC = 5;
export const TIKTOK_MIN_EXCERPT_SEC = 3.2;
export const TIKTOK_USER_MEDIA_MAX = 20;
export const TIKTOK_MAX_SOUNDBITES = 3;
export const TIKTOK_MAX_SOUNDBITE_TOTAL_SEC = 16;

export type TiktokDraftStep = "awaiting_url" | "awaiting_media";

export type TiktokExtraMedia = {
  kind: "url" | "photo" | "video";
  url?: string;
  fileId?: string;
  mime?: string;
  /** Durée Telegram (secondes) — sert au découpage intelligent. */
  durationSec?: number;
};

export type TiktokScene = {
  text: string;
  visualQuery: string;
  kind: "video" | "photo";
  person?: string;
};

export type TiktokScript = {
  title: string;
  script: string;
  caption: string;
  scenes: TiktokScene[];
};

export type TiktokClipRole = "broll" | "soundbite";

export type TiktokTimelineClip = {
  source: string;
  kind: "video" | "photo";
  duration: number;
  trimStart?: number;
  time?: number;
  role?: TiktokClipRole;
};

export type TiktokVoiceSegment = {
  time: number;
  duration: number;
  trimStart: number;
};

export type TiktokMontagePlan = {
  durationSec: number;
  clips: TiktokTimelineClip[];
  voiceSegments: TiktokVoiceSegment[];
  soundbiteCount: number;
};

export type TiktokJobPhase =
  | "scrape"
  | "script"
  | "voice"
  | "media"
  | "render"
  | "preview"
  | "posting"
  | "posted"
  | "failed"
  | "cancelled";

export function countWords(text: string): number {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function isDurationInTarget(ms: number): boolean {
  return ms >= TIKTOK_MIN_DURATION_MS && ms <= TIKTOK_MAX_DURATION_MS;
}

export function canPostToTikTok(ms: number): boolean {
  return ms >= TIKTOK_HARD_POST_MIN_MS;
}

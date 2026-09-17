export const TIKTOK_DRAFT_TTL_MS = 30 * 60 * 1000;

/** Cible Creator Rewards : strictement > 60 s, idéalement 1:02–1:20. */
export const TIKTOK_MIN_DURATION_MS = 62_000;
export const TIKTOK_MAX_DURATION_MS = 80_000;
export const TIKTOK_HARD_POST_MIN_MS = 60_001;

export const TIKTOK_SCRIPT_MIN_WORDS = 165;
export const TIKTOK_SCRIPT_MAX_WORDS = 200;
export const TIKTOK_SCRIPT_TARGET_WORDS = 180;

export const TIKTOK_TTS_MAX_ATTEMPTS = 3;

export type TiktokDraftStep = "awaiting_url" | "awaiting_media";

export type TiktokExtraMedia = {
  kind: "url" | "photo" | "video";
  url?: string;
  fileId?: string;
  mime?: string;
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

export type TiktokTimelineClip = {
  source: string;
  kind: "video" | "photo";
  duration: number;
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

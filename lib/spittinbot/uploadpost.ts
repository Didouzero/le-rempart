/**
 * Client Upload-Post minimal pour @spittinbot.
 * Doc : https://docs.upload-post.com/api/upload-video/
 */

const UP_BASE = "https://api.upload-post.com/api";

export const PLATFORMS = [
  { key: "youtube", label: "YouTube", bit: 1 },
  { key: "tiktok", label: "TikTok", bit: 2 },
  { key: "instagram", label: "Instagram", bit: 4 },
  { key: "facebook", label: "Facebook", bit: 8 },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];
export const ALL_MASK = PLATFORMS.reduce((m, p) => m | p.bit, 0);

export function maskToPlatforms(mask: number): PlatformKey[] {
  return PLATFORMS.filter((p) => mask & p.bit).map((p) => p.key);
}

export function platformsToMask(keys: Iterable<string>): number {
  const set = new Set(keys);
  return PLATFORMS.filter((p) => set.has(p.key)).reduce((m, p) => m | p.bit, 0);
}

export function platformLabel(key: string): string {
  return PLATFORMS.find((p) => p.key === key)?.label ?? key;
}

function apiKey(): string {
  const k = process.env.UPLOAD_POST_API_KEY;
  if (!k) throw new Error("UPLOAD_POST_API_KEY is not set");
  return k;
}

export type PlatformResult = { ok: boolean | null; text: string };

export const DEFAULT_HASHTAGS = "#clash #débat #politique #actu";

function hashtags(): string {
  return (process.env.SPITTIN_HASHTAGS || DEFAULT_HASHTAGS).trim();
}

export async function uploadPostPublish(opts: {
  video: Buffer;
  filename: string;
  title: string;
  platforms: PlatformKey[];
  requestId: string;
}): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const tags = hashtags();
  // légende / description partout : "titre + #"
  const caption = tags ? `${opts.title}\n\n${tags}` : opts.title;

  const form = new FormData();
  form.append("user", process.env.UPLOAD_POST_USER || "spittinfakt");
  form.append("title", opts.title.slice(0, 2200));
  form.append("async_upload", "true");
  form.append("request_id", opts.requestId);
  for (const p of opts.platforms) form.append("platform[]", p);

  if (opts.platforms.includes("youtube")) {
    form.append("youtube_title", opts.title.slice(0, 100));
    form.append("youtube_description", caption);
    for (const t of tags.split(/\s+/).filter(Boolean)) form.append("tags[]", t.replace(/^#/, ""));
    form.append("privacyStatus", "public");
    form.append("selfDeclaredMadeForKids", "false");
    form.append("containsSyntheticMedia", "false"); // « fait avec l'IA » : non
    form.append("hasPaidProductPlacement", "false"); // « promotion rémunérée » : non
    form.append("defaultLanguage", "fr");
    form.append("defaultAudioLanguage", "fr");
  }
  if (opts.platforms.includes("tiktok")) {
    form.append("tiktok_title", caption.slice(0, 2200));
    form.append("privacy_level", "PUBLIC_TO_EVERYONE");
  }
  if (opts.platforms.includes("instagram")) {
    form.append("instagram_title", caption.slice(0, 2200));
    form.append("media_type", "REELS");
    form.append("share_to_feed", "true");
  }
  if (opts.platforms.includes("facebook")) {
    const pageId = process.env.SPITTIN_FB_PAGE_ID;
    if (pageId) form.append("facebook_page_id", pageId);
    form.append("facebook_media_type", "REELS");
    form.append("facebook_title", caption);
    form.append("description", caption);
  }
  form.append(
    "video",
    new Blob([new Uint8Array(opts.video)], { type: "video/mp4" }),
    opts.filename,
  );

  const res = await fetch(`${UP_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Apikey ${apiKey()}`, "Idempotency-Key": opts.requestId },
    body: form,
  });
  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = { success: false, error: `Réponse illisible (HTTP ${res.status})` };
  }
  return { httpStatus: res.status, body };
}

export async function uploadPostStatus(requestId: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${UP_BASE}/uploadposts/status?request_id=${encodeURIComponent(requestId)}`,
    { headers: { Authorization: `Apikey ${apiKey()}` }, cache: "no-store" },
  );
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return { status: "unknown" };
  }
}

const PENDING = new Set(["queued", "processing", "retryable", "pending", "in_progress"]);

/** Normalise les résultats (objet par plateforme ou liste) -> {plateforme: résultat}. */
export function describeResults(
  results: unknown,
  platforms: PlatformKey[],
): Partial<Record<PlatformKey, PlatformResult>> {
  type Item = Record<string, unknown>;
  let items: Item[] = [];
  if (Array.isArray(results)) items = results as Item[];
  else if (results && typeof results === "object") {
    items = Object.entries(results as Record<string, Item>)
      .filter(([, v]) => v && typeof v === "object")
      .map(([k, v]) => ({ ...v, platform: k }));
  }
  const out: Partial<Record<PlatformKey, PlatformResult>> = {};
  for (const it of items) {
    const p = it.platform as PlatformKey;
    if (!platforms.includes(p)) continue;
    const url = (it.url || it.post_url || "") as string;
    if (it.skipped) out[p] = { ok: false, text: `ignoré (${it.skip_reason ?? "non connecté"})` };
    else if (it.success === true) out[p] = { ok: true, text: url || "publié" };
    else if (PENDING.has(String(it.status ?? ""))) out[p] = { ok: null, text: "en cours…" };
    else if (it.success === false || it.error || it.status === "failed")
      out[p] = { ok: false, text: String(it.error || it.message || "échec").slice(0, 200) };
    else out[p] = { ok: null, text: "en cours…" };
  }
  return out;
}

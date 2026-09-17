import { prisma } from "@/lib/prisma";
import { tiktokRenderPublicUrl } from "@/lib/tiktok/media";

const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_CREATOR_INFO =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const TIKTOK_DIRECT_INIT =
  "https://open.tiktokapis.com/v2/post/publish/video/init/";
const TIKTOK_INBOX_INIT =
  "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const TIKTOK_STATUS =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

export type TiktokOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresAt: number;
  scope?: string;
};

const OAUTH_KEY = "tiktok:oauth";

export function isTiktokAppConfigured(): boolean {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY?.trim() &&
      process.env.TIKTOK_CLIENT_SECRET?.trim(),
  );
}

export function tiktokPostMode(): "inbox" | "direct" {
  return process.env.TIKTOK_POST_MODE?.trim() === "direct" ? "direct" : "inbox";
}

export async function loadTiktokTokens(): Promise<TiktokOAuthTokens | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: OAUTH_KEY } });
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value) as TiktokOAuthTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveTiktokTokens(tokens: TiktokOAuthTokens): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: OAUTH_KEY },
    create: { key: OAUTH_KEY, value: JSON.stringify(tokens) },
    update: { value: JSON.stringify(tokens) },
  });
}

export async function clearTiktokTokens(): Promise<void> {
  await prisma.appSetting.delete({ where: { key: OAUTH_KEY } }).catch(() => {});
}

async function refreshAccessToken(
  tokens: TiktokOAuthTokens,
): Promise<TiktokOAuthTokens> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) {
    throw new Error("App TikTok non configurée (TIKTOK_CLIENT_KEY / SECRET).");
  }
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    open_id?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Refresh token TikTok refusé",
    );
  }
  const next: TiktokOAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokens.refreshToken,
    openId: data.open_id || tokens.openId,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    scope: data.scope || tokens.scope,
  };
  await saveTiktokTokens(next);
  return next;
}

export async function getValidTiktokTokens(): Promise<TiktokOAuthTokens> {
  const tokens = await loadTiktokTokens();
  if (!tokens) {
    throw new Error(
      "Compte TikTok non relié. Va dans /admin/tiktok pour connecter Droitocratie.",
    );
  }
  if (tokens.expiresAt - 120_000 > Date.now()) return tokens;
  return refreshAccessToken(tokens);
}

async function tiktokJson(
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ data?: Record<string, unknown>; error?: { code?: string; message?: string } }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return (await res.json()) as {
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string };
  };
}

export type TiktokPublishResult = {
  mode: "inbox" | "direct";
  publishId: string;
  privacy?: string;
};

function isFailed(res: {
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}): boolean {
  const code = res.error?.code;
  return !res.data?.publish_id || Boolean(code && code !== "ok");
}

function needsFileUpload(res: {
  error?: { code?: string; message?: string };
}): boolean {
  const blob = `${res.error?.code || ""} ${res.error?.message || ""}`;
  return /url_ownership_unverified|video_url|PULL_FROM_URL|unverified/i.test(blob);
}

async function putTiktokVideo(uploadUrl: string, video: Buffer): Promise<void> {
  const size = video.length;
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: video,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`Upload fichier TikTok HTTP ${res.status}`);
  }
}

async function downloadRender(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error("Impossible de télécharger le MP4 pour TikTok.");
  return Buffer.from(await res.arrayBuffer());
}

export async function publishJobToTikTok(input: {
  jobId: string;
  fileToken: string;
  caption: string;
  renderUrl: string;
}): Promise<TiktokPublishResult> {
  const tokens = await getValidTiktokTokens();
  const videoUrl = tiktokRenderPublicUrl(input.jobId, input.fileToken);
  const mode = tiktokPostMode();
  const title = input.caption.replace(/\s+/g, " ").trim().slice(0, 2200);
  const privacy =
    process.env.TIKTOK_PRIVACY_LEVEL?.trim() || "PUBLIC_TO_EVERYONE";

  const fileSource = (video: Buffer) => ({
    source: "FILE_UPLOAD" as const,
    video_size: video.length,
    chunk_size: video.length,
    total_chunk_count: 1,
  });

  if (mode === "direct") {
    const creator = await tiktokJson(TIKTOK_CREATOR_INFO, tokens.accessToken, {});
    if (creator.error?.code && creator.error.code !== "ok") {
      throw new Error(
        creator.error.message || "Impossible de lire le compte TikTok.",
      );
    }

    const tryDirect = async (
      privacyLevel: string,
      sourceInfo: Record<string, unknown>,
    ) =>
      tiktokJson(TIKTOK_DIRECT_INIT, tokens.accessToken, {
        post_info: {
          title,
          privacy_level: privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 800,
        },
        source_info: sourceInfo,
      });

    let usedPrivacy = privacy;
    let init = await tryDirect(privacy, {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    });
    if (isFailed(init) && /unaudited|SELF_ONLY|privacy/i.test(
      `${init.error?.code || ""} ${init.error?.message || ""}`,
    )) {
      usedPrivacy = "SELF_ONLY";
      init = await tryDirect("SELF_ONLY", {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      });
    }
    if (isFailed(init) && needsFileUpload(init)) {
      const video = await downloadRender(input.renderUrl);
      init = await tryDirect(usedPrivacy, fileSource(video));
      const uploadUrl = init.data?.upload_url;
      if (typeof uploadUrl === "string") {
        await putTiktokVideo(uploadUrl, video);
      }
    }
    if (isFailed(init)) {
      throw new Error(
        init.error?.message ||
          "Direct Post TikTok refusé. Passe TIKTOK_POST_MODE=inbox ou fais auditer l’app.",
      );
    }
    return {
      mode: "direct",
      publishId: String(init.data?.publish_id),
      privacy: usedPrivacy,
    };
  }

  let inbox = await tiktokJson(TIKTOK_INBOX_INIT, tokens.accessToken, {
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
  });
  if (isFailed(inbox) && needsFileUpload(inbox)) {
    const video = await downloadRender(input.renderUrl);
    inbox = await tiktokJson(TIKTOK_INBOX_INIT, tokens.accessToken, {
      source_info: fileSource(video),
    });
    const uploadUrl = inbox.data?.upload_url;
    if (typeof uploadUrl === "string") {
      await putTiktokVideo(uploadUrl, video);
    }
  }
  if (isFailed(inbox)) {
    throw new Error(inbox.error?.message || "Envoi Inbox TikTok refusé.");
  }
  return {
    mode: "inbox",
    publishId: String(inbox.data?.publish_id),
  };
}

export async function fetchTiktokPublishStatus(publishId: string): Promise<string> {
  const tokens = await getValidTiktokTokens();
  const res = await tiktokJson(TIKTOK_STATUS, tokens.accessToken, {
    publish_id: publishId,
  });
  const status = res.data?.status;
  return typeof status === "string" ? status : res.error?.message || "unknown";
}

export { TIKTOK_TOKEN_URL };

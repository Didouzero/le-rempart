import { randomBytes } from "crypto";
import { absoluteUrl } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import {
  TIKTOK_TOKEN_URL,
  saveTiktokTokens,
  tiktokClientKey,
  tiktokClientSecret,
  tiktokPostMode,
} from "@/lib/tiktok/publish";

const STATE_KEY = "tiktok:oauth:state";

export function tiktokRedirectUri(): string {
  return (
    process.env.TIKTOK_REDIRECT_URI?.trim() ||
    absoluteUrl("/api/tiktok/oauth")
  );
}

export function tiktokAuthorizeUrl(state: string): string {
  const clientKey = tiktokClientKey();
  if (!clientKey) throw new Error("TIKTOK_CLIENT_KEY manquant.");
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("response_type", "code");
  // Inbox n’a besoin que de video.upload. Demander video.publish avant
  // l’audit TikTok fait échouer Login Kit (« we couldn't authenticate you »).
  const scopes =
    tiktokPostMode() === "direct"
      ? "user.info.basic,video.upload,video.publish"
      : "user.info.basic,video.upload";
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", tiktokRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export async function createTiktokOAuthState(): Promise<string> {
  const state = randomBytes(24).toString("hex");
  await prisma.appSetting.upsert({
    where: { key: STATE_KEY },
    create: {
      key: STATE_KEY,
      value: JSON.stringify({ state, at: Date.now() }),
    },
    update: { value: JSON.stringify({ state, at: Date.now() }) },
  });
  return state;
}

export async function consumeTiktokOAuthState(state: string): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: STATE_KEY } });
  if (!row?.value) return false;
  try {
    const parsed = JSON.parse(row.value) as { state?: string; at?: number };
    await prisma.appSetting.delete({ where: { key: STATE_KEY } }).catch(() => {});
    if (parsed.state !== state) return false;
    if (!parsed.at || Date.now() - parsed.at > 15 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export async function exchangeTiktokCode(code: string): Promise<void> {
  const clientKey = tiktokClientKey();
  const clientSecret = tiktokClientSecret();
  if (!clientKey || !clientSecret) {
    throw new Error("App TikTok non configurée.");
  }
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirectUri(),
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
  if (!res.ok || !data.access_token || !data.refresh_token || !data.open_id) {
    throw new Error(
      data.error_description || data.error || "Échange OAuth TikTok refusé",
    );
  }
  await saveTiktokTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    scope: data.scope,
  });
}

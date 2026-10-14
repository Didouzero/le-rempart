import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Branche le webhook Telegram de @spittinbot sur ce déploiement.
 * GET /api/spittinbot/setup?secret=<SPITTIN_WEBHOOK_SECRET>[&bypass=<secret Vercel>]
 * (le paramètre bypass ne sert que pour les déploiements de prévisualisation protégés)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.SPITTIN_WEBHOOK_SECRET;
  const token = process.env.SPITTIN_BOT_TOKEN;
  const params = req.nextUrl.searchParams;
  if (!secret || !token || params.get("secret") !== secret) {
    // n'expose que la présence des variables, jamais leur valeur
    const present = Object.fromEntries(
      ["SPITTIN_WEBHOOK_SECRET", "SPITTIN_BOT_TOKEN", "SPITTIN_TG_API_ID", "SPITTIN_TG_API_HASH",
        "SPITTIN_ALLOWED_USER_IDS", "UPLOAD_POST_API_KEY"].map((k) => [k, Boolean(process.env[k])]),
    );
    return NextResponse.json({ ok: false, present, env: process.env.VERCEL_ENV }, { status: 401 });
  }
  const host = req.headers.get("x-forwarded-host") || req.nextUrl.host;
  const hook = new URL(`https://${host}/api/spittinbot/webhook`);
  const bypass = params.get("bypass");
  if (bypass) hook.searchParams.set("x-vercel-protection-bypass", bypass);

  const tg = (method: string, body: Record<string, unknown>) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const set = await tg("setWebhook", {
    url: hook.toString(),
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const info = (await tg("getWebhookInfo", {})) as { result?: Record<string, unknown> };
  const me = (await tg("getMe", {})) as { result?: { username?: string } };
  return NextResponse.json({
    setWebhook: set,
    bot: me.result?.username,
    webhook: { ...info.result, url: String(info.result?.url ?? "").replace(/x-vercel-protection-bypass=[^&]+/, "x-vercel-protection-bypass=***") },
  });
}

/**
 * @spittinbot : on envoie une vidéo au bot, il demande le titre, puis la
 * publie sur YouTube Shorts, TikTok, Instagram et Facebook via Upload-Post.
 *
 * La vidéo en attente de titre est gardée dans AppSetting
 * (clé spittinbot:pending:<chatId>). Le message de suivi est envoyé en réponse
 * à la vidéo : le bouton « Réessayer » la retrouve via reply_to_message.
 */
import { prisma } from "@/lib/prisma";
import { downloadBotMessageMedia } from "@/lib/spittinbot/mtproto";
import {
  ALL_MASK,
  type PlatformKey,
  type PlatformResult,
  describeResults,
  maskToPlatforms,
  platformLabel,
  platformsToMask,
  uploadPostPublish,
  uploadPostStatus,
} from "@/lib/spittinbot/uploadpost";

const TG = "https://api.telegram.org";
const BOT_API_FILE_LIMIT = 20 * 1024 * 1024;
const TITLE_PREFIX = "🎬 ";
const PLATFORMS_PREFIX = "Plateformes : ";
const ASK_TITLE = "✍️ Et maintenant, donne-moi un titre :";

type TgUser = { id: number; is_bot?: boolean };
type TgFile = { file_id: string; file_size?: number; mime_type?: string; file_name?: string };
type TgMessage = {
  message_id: number;
  chat: { id: number };
  from?: TgUser;
  text?: string;
  caption?: string;
  video?: TgFile;
  document?: TgFile;
  reply_to_message?: TgMessage;
};
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
};

// ------------------------------------------------------------------ API Bot
function token(): string {
  const t = process.env.SPITTIN_BOT_TOKEN;
  if (!t) throw new Error("SPITTIN_BOT_TOKEN is not set");
  return t;
}

async function tg(method: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${TG}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: Record<string, unknown> };
  if (!data.ok && !String(data.description).includes("message is not modified")) {
    console.error(`spittinbot ${method} failed`, data.description || res.status);
  }
  return data.result ?? null;
}

const send = (chatId: number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...extra });

const edit = (chatId: number, messageId: number, text: string, keyboard?: unknown[][]) =>
  tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard ?? [] },
  });

const answer = (id: string, text?: string, alert = false) =>
  tg("answerCallbackQuery", { callback_query_id: id, text, show_alert: alert });

async function downloadVideo(video: TgMessage): Promise<Buffer> {
  const file = video.video ?? video.document;
  if (!file) throw new Error("Pas de vidéo dans le message d'origine");
  if ((file.file_size ?? Infinity) <= BOT_API_FILE_LIMIT) {
    const info = await tg("getFile", { file_id: file.file_id });
    const path = info?.file_path as string | undefined;
    if (path) {
      const res = await fetch(`${TG}/file/bot${token()}/${path}`);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }
  }
  return downloadBotMessageMedia(video.message_id);
}

// ------------------------------------------------------------------ vidéo en attente
const pendingKey = (chatId: number) => `spittinbot:pending:${chatId}`;

async function setPending(video: TgMessage) {
  const key = pendingKey(video.chat.id);
  const value = JSON.stringify(video);
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

async function takePending(chatId: number): Promise<TgMessage | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: pendingKey(chatId) } });
  if (!row) return null;
  await prisma.appSetting.delete({ where: { key: row.key } }).catch(() => {});
  try {
    return JSON.parse(row.value) as TgMessage;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ messages
function statusText(title: string, mask: number, footer?: string): string {
  const lines = [
    TITLE_PREFIX + title,
    "",
    PLATFORMS_PREFIX + maskToPlatforms(mask).map(platformLabel).join(" · "),
  ];
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

function titleFromStatus(text: string): string {
  const first = text.split("\n")[0] ?? "";
  return first.startsWith(TITLE_PREFIX) ? first.slice(TITLE_PREFIX.length).trim() : "";
}

function cleanTitle(raw: string): string {
  return raw.trim().replace(/\s*\n+\s*/g, " ");
}

function isVideo(m: TgMessage): boolean {
  return Boolean(m.video || (m.document && (m.document.mime_type ?? "").startsWith("video/")));
}

// ------------------------------------------------------------------ handlers
export function isAllowed(userId?: number): boolean {
  const ids = (process.env.SPITTIN_ALLOWED_USER_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  return Boolean(userId && ids.includes(userId));
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const m = update.message;
  if (!m || !isAllowed(m.from?.id)) return;
  const chatId = m.chat.id;

  if (m.text?.startsWith("/start") || m.text?.startsWith("/aide")) {
    await send(
      chatId,
      [
        "👋 Bot spittinfakt prêt.",
        "",
        "1) Envoie-moi la vidéo (en fichier 📎 → Fichier, pour garder la qualité)",
        "2) Je te demande le titre, tu l'envoies",
        "3) Elle part sur YouTube, TikTok, Instagram et Facebook",
        "",
        "/annuler — oublier la vidéo en attente de titre",
      ].join("\n"),
    );
    return;
  }

  if (m.text?.startsWith("/annuler")) {
    const had = await takePending(chatId);
    await send(chatId, had ? "❌ Vidéo en attente annulée." : "Aucune vidéo en attente.");
    return;
  }

  if (isVideo(m)) {
    const caption = cleanTitle(m.caption ?? "");
    if (caption) return startPublish(m, caption);
    await setPending(m);
    await send(chatId, ASK_TITLE, {
      reply_to_message_id: m.message_id,
      reply_markup: { force_reply: true, input_field_placeholder: "Titre de la vidéo" },
    });
    return;
  }

  if (m.text && !m.text.startsWith("/")) {
    const video = await takePending(chatId);
    if (!video) {
      await send(chatId, "🎬 Envoie-moi d'abord une vidéo, je te demanderai le titre ensuite.");
      return;
    }
    await startPublish(video, cleanTitle(m.text));
  }
}

async function startPublish(video: TgMessage, title: string) {
  const status = await send(video.chat.id, statusText(title, ALL_MASK, "⏳ C'est parti…"), {
    reply_to_message_id: video.message_id,
  });
  const statusId = Number(status?.message_id);
  if (!statusId) return;
  await publish(video.chat.id, statusId, video, title, maskToPlatforms(ALL_MASK));
}

async function handleCallback(cq: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  if (!isAllowed(cq.from.id)) return void (await answer(cq.id, "Non autorisé"));
  const msg = cq.message;
  const data = cq.data ?? "";
  if (!msg?.text || !data.startsWith("rt:")) return void (await answer(cq.id));
  const title = titleFromStatus(msg.text);
  const video = msg.reply_to_message;
  if (!title || !video || !isVideo(video)) {
    return void (await answer(cq.id, "Vidéo d'origine introuvable, renvoie-la.", true));
  }
  await answer(cq.id, "On réessaie 🔁");
  await publish(msg.chat.id, msg.message_id, video, title, maskToPlatforms(Number(data.slice(3))));
}

// ------------------------------------------------------------------ publication
const ICON = { true: "✅", false: "❌", null: "⏳" } as const;

function resultsText(res: Partial<Record<PlatformKey, PlatformResult>>, platforms: PlatformKey[]): string {
  return platforms
    .map((p) => {
      const v = res[p] ?? { ok: null, text: "en attente…" };
      return `${ICON[String(v.ok) as keyof typeof ICON]} ${platformLabel(p)} — ${v.text}`;
    })
    .join("\n");
}

async function publish(chatId: number, statusId: number, video: TgMessage, title: string, platforms: PlatformKey[]) {
  const mask = platformsToMask(platforms);
  const status = (footer: string, kb?: unknown[][]) => edit(chatId, statusId, statusText(title, mask, footer), kb);
  const retry = (failed: PlatformKey[]) => [[{ text: "🔁 Réessayer", callback_data: `rt:${platformsToMask(failed)}` }]];
  const requestId = `tg-${chatId}-${video.message_id}-${Date.now()}`;
  try {
    await status("⬇️ Récupération de la vidéo…");
    const buf = await downloadVideo(video);
    await status(`⬆️ Envoi à Upload-Post (${(buf.length / 1048576).toFixed(1)} Mo)…`);
    const filename = video.document?.file_name || `spittinfakt-${video.message_id}.mp4`;
    const { httpStatus, body } = await uploadPostPublish({ video: buf, filename, title, platforms, requestId });
    console.log("spittinbot upload", httpStatus, JSON.stringify(body).slice(0, 1000));
    if (!body.success) {
      const err = String(body.message || body.error || JSON.stringify(body)).slice(0, 400);
      await status(`⚠️ Upload-Post a refusé l'envoi (HTTP ${httpStatus}) :\n${err}`, retry(platforms));
      return;
    }

    let res = body.results ? describeResults(body.results, platforms) : {};
    const rid = String(body.request_id || requestId);
    const t0 = Date.now();
    const done = () => platforms.every((p) => res[p] && res[p]!.ok !== null);
    while (!done() && Date.now() - t0 < 12 * 60 * 1000) {
      await new Promise((ok) => setTimeout(ok, 8000));
      const st = await uploadPostStatus(rid);
      res = describeResults(st.results, platforms);
      const prog = st.total ? `Progression : ${st.completed ?? 0}/${st.total}\n` : "";
      await status(prog + resultsText(res, platforms));
      if (st.status === "completed" || st.status === "failed") {
        for (const p of platforms) if (!res[p] || res[p]!.ok === null) res[p] = { ok: false, text: "pas de retour d'Upload-Post" };
        break;
      }
    }

    const failed = platforms.filter((p) => !res[p]?.ok);
    if (failed.length === 0) {
      await status(resultsText(res, platforms) + "\n\n✅ Publié partout !");
    } else if (failed.every((p) => !res[p] || res[p]!.ok === null)) {
      await status(resultsText(res, platforms) + "\n\n⏳ Toujours en cours côté Upload-Post — vérifie ton tableau de bord.");
    } else {
      await status(resultsText(res, platforms) + "\n\n⚠️ Certaines plateformes ont échoué.", retry(failed));
    }
  } catch (e) {
    console.error("spittinbot publish error", e);
    await status(`⚠️ Erreur : ${String((e as Error).message || e).slice(0, 300)}`, retry(platforms));
  }
}


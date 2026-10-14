/**
 * @spittinbot : on envoie une vidéo au bot, elle part sur YouTube Shorts,
 * TikTok, Instagram et Facebook via Upload-Post.
 *
 * Sans état en base : le récap (message du bot, en réponse à la vidéo) porte
 * le titre, la description et les plateformes cochées. Les boutons relisent
 * ce message, et la vidéo est retrouvée via reply_to_message.
 */
import { downloadBotMessageMedia } from "@/lib/spittinbot/mtproto";
import {
  ALL_MASK,
  PLATFORMS,
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
const NO_TITLE = "(sans titre)";
const TITLE_PREFIX = "🎬 ";
const DESC_PREFIX = "📝 ";
const PLATFORMS_PREFIX = "Plateformes : ";

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

// ------------------------------------------------------------------ récap
type Recap = { title: string; description: string; mask: number };

function recapText(r: Recap, footer?: string): string {
  const lines = [TITLE_PREFIX + (r.title || NO_TITLE)];
  if (r.description) lines.push(DESC_PREFIX + r.description);
  lines.push("", PLATFORMS_PREFIX + (maskToPlatforms(r.mask).map(platformLabel).join(" · ") || "aucune"));
  if (!r.title) lines.push("", "↩️ Réponds à ce message avec le titre (1re ligne) et, si tu veux, la description dessous.");
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

function parseRecap(text: string): Recap {
  const lines = text.split("\n");
  const title = (lines[0] ?? "").startsWith(TITLE_PREFIX) ? lines[0].slice(TITLE_PREFIX.length).trim() : "";
  const descLines: string[] = [];
  let mask = ALL_MASK;
  let inDesc = false;
  for (const l of lines.slice(1)) {
    if (l.startsWith(DESC_PREFIX)) {
      inDesc = true;
      descLines.push(l.slice(DESC_PREFIX.length));
    } else if (l.startsWith(PLATFORMS_PREFIX)) {
      inDesc = false;
      const labels = l.slice(PLATFORMS_PREFIX.length).split(" · ");
      mask = platformsToMask(PLATFORMS.filter((p) => labels.includes(p.label)).map((p) => p.key));
    } else if (inDesc && l !== "") descLines.push(l);
    else inDesc = false;
  }
  return { title: title === NO_TITLE ? "" : title, description: descLines.join("\n").trim(), mask };
}

function keyboard(mask: number): unknown[][] {
  const toggles = PLATFORMS.map((p) => ({
    text: (mask & p.bit ? "✅ " : "⬜️ ") + p.label,
    callback_data: `t:${p.bit}`,
  }));
  return [
    toggles.slice(0, 2),
    toggles.slice(2),
    [
      { text: "🚀 Publier", callback_data: "go" },
      { text: "✏️ Titre", callback_data: "ti" },
      { text: "❌ Annuler", callback_data: "x" },
    ],
  ];
}

function splitTitle(raw: string): { title: string; description: string } {
  const [first, ...rest] = raw.trim().split("\n");
  return { title: (first ?? "").trim(), description: rest.join("\n").trim() };
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

  if (m.text?.startsWith("/start") || m.text?.startsWith("/aide")) {
    await send(
      m.chat.id,
      [
        "👋 Bot spittinfakt prêt.",
        "",
        "Envoie-moi une vidéo avec le titre en légende (1re ligne = titre, le reste = description facultative).",
        "Je te montre un récap, tu valides, et elle part sur YouTube, TikTok, Instagram et Facebook.",
        "",
        "Astuce : envoie-la en fichier (📎 → Fichier) pour garder la qualité d'origine.",
      ].join("\n"),
    );
    return;
  }

  if (isVideo(m)) {
    const { title, description } = splitTitle(m.caption ?? "");
    const r: Recap = { title, description, mask: ALL_MASK };
    await send(m.chat.id, recapText(r), {
      reply_to_message_id: m.message_id,
      reply_markup: { inline_keyboard: keyboard(r.mask) },
    });
    return;
  }

  // réponse texte au récap = nouveau titre / description
  const target = m.reply_to_message;
  if (m.text && target?.from?.is_bot && target.text?.startsWith(TITLE_PREFIX)) {
    const cur = parseRecap(target.text);
    const { title, description } = splitTitle(m.text);
    const r: Recap = { title, description: description || cur.description, mask: cur.mask };
    await edit(m.chat.id, target.message_id, recapText(r), keyboard(r.mask));
    await tg("deleteMessage", { chat_id: m.chat.id, message_id: m.message_id });
  }
}

async function handleCallback(cq: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  if (!isAllowed(cq.from.id)) return void (await answer(cq.id, "Non autorisé"));
  const msg = cq.message;
  const data = cq.data ?? "";
  if (!msg?.text) return void (await answer(cq.id));
  const chatId = msg.chat.id;
  const r = parseRecap(msg.text);

  if (data.startsWith("t:")) {
    r.mask ^= Number(data.slice(2));
    await edit(chatId, msg.message_id, recapText(r), keyboard(r.mask));
    return void (await answer(cq.id));
  }
  if (data === "ti") {
    await answer(cq.id, "↩️ Réponds au récap avec le nouveau titre", true);
    return;
  }
  if (data === "x") {
    await edit(chatId, msg.message_id, recapText(r, "❌ Annulé."));
    return void (await answer(cq.id));
  }
  if (data === "go" || data.startsWith("rt:")) {
    const mask = data === "go" ? r.mask : Number(data.slice(3));
    if (!r.title) return void (await answer(cq.id, "Ajoute d'abord un titre (réponds au récap).", true));
    if (!mask) return void (await answer(cq.id, "Coche au moins une plateforme.", true));
    const video = msg.reply_to_message;
    if (!video || !isVideo(video)) {
      return void (await answer(cq.id, "Vidéo d'origine introuvable, renvoie-la.", true));
    }
    await answer(cq.id, "C'est parti 🚀");
    await publish(chatId, msg.message_id, video, r, maskToPlatforms(mask));
  }
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

async function publish(chatId: number, recapId: number, video: TgMessage, r: Recap, platforms: PlatformKey[]) {
  const status = (footer: string, kb?: unknown[][]) => edit(chatId, recapId, recapText(r, footer), kb);
  const requestId = `tg-${chatId}-${video.message_id}-${Date.now()}`;
  try {
    await status("⬇️ Récupération de la vidéo…");
    const buf = await downloadVideo(video);
    await status(`⬆️ Envoi à Upload-Post (${(buf.length / 1048576).toFixed(1)} Mo)…`);
    const filename = video.document?.file_name || `spittinfakt-${video.message_id}.mp4`;
    const { httpStatus, body } = await uploadPostPublish({
      video: buf,
      filename,
      title: r.title,
      description: r.description,
      platforms,
      requestId,
    });
    console.log("spittinbot upload", httpStatus, JSON.stringify(body).slice(0, 1000));
    if (!body.success) {
      const err = String(body.message || body.error || JSON.stringify(body)).slice(0, 400);
      await status(`⚠️ Upload-Post a refusé l'envoi (HTTP ${httpStatus}) :\n${err}`, [
        [{ text: "🔁 Réessayer", callback_data: `rt:${platformsToMask(platforms)}` }],
      ]);
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
    } else if (failed.every((p) => res[p]?.ok === null || !res[p])) {
      await status(resultsText(res, platforms) + "\n\n⏳ Toujours en cours côté Upload-Post — vérifie ton tableau de bord.");
    } else {
      await status(resultsText(res, platforms) + "\n\n⚠️ Certaines plateformes ont échoué.", [
        [{ text: "🔁 Réessayer les échecs", callback_data: `rt:${platformsToMask(failed)}` }],
      ]);
    }
  } catch (e) {
    console.error("spittinbot publish error", e);
    await status(`⚠️ Erreur : ${String((e as Error).message || e).slice(0, 300)}`, [
      [{ text: "🔁 Réessayer", callback_data: `rt:${platformsToMask(platforms)}` }],
    ]);
  }
}

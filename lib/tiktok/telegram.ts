import { extractHttpUrl } from "@/lib/publish-draft";
import { extractAllHttpUrls } from "@/lib/investigation-draft";
import {
  telegramAnswerCallbackQuery,
  telegramSendMessage,
  type TelegramUpdate,
} from "@/lib/telegram";
import {
  addTiktokDraftMedia,
  deleteTiktokDraft,
  getActiveTiktokDraft,
  popTiktokDraftMedia,
  setTiktokDraftSourceUrl,
  startTiktokDraft,
} from "@/lib/tiktok/draft";
import {
  cancelTiktokJob,
  createTiktokJob,
  getLatestPreviewJob,
  publishTiktokJob,
  redoTiktokJob,
  runTiktokJob,
  scheduleTiktokJob,
} from "@/lib/tiktok/job";
import { isCreatomateConfigured } from "@/lib/tiktok/render";
import { isElevenLabsConfigured } from "@/lib/tiktok/voice";
import { isTiktokAppConfigured, loadTiktokTokens } from "@/lib/tiktok/publish";
import type { TiktokExtraMedia } from "@/lib/tiktok/types";
import { TIKTOK_USER_MEDIA_MAX } from "@/lib/tiktok/types";

export const TIKTOK_COMMANDS = new Set([
  "/tiktok",
  "/tt",
  "/tiktok_go",
  "/tiktok_ok",
  "/tiktok_undo",
  "/tiktok_cancel",
  "/tiktok_annuler",
]);

function mediaKindLabel(kind: TiktokExtraMedia["kind"]): string {
  if (kind === "video") return "vidéo";
  if (kind === "photo") return "photo";
  return "lien";
}

function mediaRoll(items: TiktokExtraMedia[]): string {
  if (items.length === 0) return "Aucun plan pour l’instant.";
  return items
    .map((item, i) => `${i + 1}. ${mediaKindLabel(item.kind)}`)
    .join("\n");
}

function mediaHint(): string {
  return [
    "À toi de trier le montage. Envoie les plans **dans l’ordre**, un par un (ou un album) :",
    "• extraits déjà coupés 3–8 s, ou une vidéo plus longue (le bot en tire les moments parlants, ex. Hollande à 0:40)",
    "• photos intercalées",
    "Sur iPhone : Photos → partager ici. Coupe toi-même si tu veux un plan précis ; sinon envoie la minute, on découpe.",
    "12 à 16 plans pour ~1 min 10. /tiktok_undo retire le dernier. Puis /tiktok_go.",
    "Sans fichier, /tiktok_go prend des photos d’actu tout seul.",
  ].join("\n");
}

async function assertPipelineReady(chatId: number): Promise<boolean> {
  const missing: string[] = [];
  if (!isElevenLabsConfigured()) missing.push("ELEVENLABS_API_KEY");
  if (!isCreatomateConfigured()) missing.push("CREATOMATE_API_KEY");
  if (missing.length) {
    await telegramSendMessage(
      chatId,
      `Pipeline incomplet : ${missing.join(", ")}. Ajoute les clés sur Vercel.`,
    );
    return false;
  }
  return true;
}

export async function handleTiktokCommand(input: {
  cmd: string;
  text: string;
  chatId: number;
  userId: number;
}): Promise<boolean> {
  const { cmd, text, chatId, userId } = input;
  if (!TIKTOK_COMMANDS.has(cmd)) return false;

  if (cmd === "/tiktok_cancel" || cmd === "/tiktok_annuler") {
    const deleted = await deleteTiktokDraft(chatId);
    const preview = await getLatestPreviewJob(chatId);
    if (preview) await cancelTiktokJob(preview.id);
    await telegramSendMessage(
      chatId,
      deleted || preview
        ? "Montage Droitocratie annulé."
        : "Aucun montage TikTok en attente.",
    );
    return true;
  }

  if (cmd === "/tiktok_undo") {
    const draft = await getActiveTiktokDraft(chatId);
    if (!draft) {
      await telegramSendMessage(chatId, "Aucun montage en cours. /tiktok d’abord.");
      return true;
    }
    if (draft.extraMedia.length === 0) {
      await telegramSendMessage(chatId, "Rien à retirer. Envoie un extrait ou une photo.");
      return true;
    }
    const updated = await popTiktokDraftMedia(chatId);
    const items = updated?.extraMedia || [];
    await telegramSendMessage(
      chatId,
      [`Dernier plan retiré (${items.length} restant${items.length > 1 ? "s" : ""}).`, mediaRoll(items)].join("\n"),
    );
    return true;
  }

  if (cmd === "/tiktok_ok") {
    const preview = await getLatestPreviewJob(chatId);
    if (!preview) {
      await telegramSendMessage(
        chatId,
        "Aucun aperçu à poster. Lance /tiktok puis /tiktok_go.",
      );
      return true;
    }
    try {
      await publishTiktokJob(preview.id);
    } catch (err) {
      await telegramSendMessage(
        chatId,
        `❌ Publication : ${err instanceof Error ? err.message : "échec"}`,
      );
    }
    return true;
  }

  if (cmd === "/tiktok_go") {
    if (!(await assertPipelineReady(chatId))) return true;
    const draft = await getActiveTiktokDraft(chatId);
    if (!draft?.sourceUrl) {
      await telegramSendMessage(
        chatId,
        "Pas de lien article. Envoie /tiktok puis l’URL, ou /tiktok https://…",
      );
      return true;
    }
    await telegramSendMessage(
      chatId,
      [
        `Montage Droitocratie — ${draft.extraMedia.length} plan${draft.extraMedia.length > 1 ? "s" : ""} de ta part.`,
        draft.sourceUrl,
      ].join("\n"),
    );
    try {
      const job = await createTiktokJob({
        chatId,
        userId,
        sourceUrl: draft.sourceUrl,
        extraMedia: draft.extraMedia,
      });
      await deleteTiktokDraft(chatId);
      const work = runTiktokJob(job.id);
      scheduleTiktokJob(work);
      await work;
    } catch (err) {
      await telegramSendMessage(
        chatId,
        `❌ /tiktok_go : ${err instanceof Error ? err.message : "échec"}`,
      );
    }
    return true;
  }

  // /tiktok or /tt
  if (!(await assertPipelineReady(chatId))) return true;
  const url = extractHttpUrl(text.replace(/^\/(tiktok|tt)\b/i, ""));
  await startTiktokDraft({ chatId, userId, sourceUrl: url || undefined });
  if (url) {
    const tokens = await loadTiktokTokens();
    const tiktokLine = isTiktokAppConfigured()
      ? tokens
        ? "Compte TikTok relié."
        : "Compte TikTok : pas encore OAuth (/admin/tiktok)."
      : "Compte TikTok : TIKTOK_CLIENT_KEY/SECRET manquants.";
    await telegramSendMessage(
      chatId,
      [`Lien reçu.`, tiktokLine, "", mediaHint()].join("\n"),
    );
  } else {
    await telegramSendMessage(
      chatId,
      [
        "Droitocratie — envoie le lien de l’article à traiter.",
        "Ensuite : extraits vidéo 3–8 s + photos, dans l’ordre, puis /tiktok_go.",
      ].join("\n"),
    );
  }
  return true;
}

export async function handleTiktokCallback(input: {
  data: string;
  chatId: number;
  callbackQueryId: string;
}): Promise<boolean> {
  if (!input.data.startsWith("tt:")) return false;
  const parts = input.data.split(":");
  const action = parts[1];
  const jobId = parts.slice(2).join(":");
  if (!jobId) {
    await telegramAnswerCallbackQuery(input.callbackQueryId, "Job manquant");
    return true;
  }

  if (action === "ok") {
    await telegramAnswerCallbackQuery(input.callbackQueryId, "Publication…");
    try {
      await publishTiktokJob(jobId);
    } catch (err) {
      await telegramSendMessage(
        input.chatId,
        `❌ Publication : ${err instanceof Error ? err.message : "échec"}`,
      );
    }
    return true;
  }

  if (action === "no") {
    await cancelTiktokJob(jobId);
    await telegramAnswerCallbackQuery(input.callbackQueryId, "Annulé");
    await telegramSendMessage(input.chatId, "Aperçu jeté. Rien n’est posté.");
    return true;
  }

  if (action === "redo") {
    await telegramAnswerCallbackQuery(input.callbackQueryId, "Nouveau montage…");
    try {
      const next = await redoTiktokJob(jobId);
      await telegramSendMessage(
        input.chatId,
        "Nouveau montage Droitocratie en cours…",
      );
      const work = runTiktokJob(next.id);
      scheduleTiktokJob(work);
      await work;
    } catch (err) {
      await telegramSendMessage(
        input.chatId,
        `❌ Refaire : ${err instanceof Error ? err.message : "échec"}`,
      );
    }
    return true;
  }

  await telegramAnswerCallbackQuery(input.callbackQueryId);
  return true;
}

function extraFromTelegramMessage(
  message: NonNullable<TelegramUpdate["message"]>,
  text: string,
): TiktokExtraMedia[] {
  const out: TiktokExtraMedia[] = [];
  if (message.photo?.length) {
    const sorted = [...message.photo].sort(
      (a, b) => b.width * b.height - a.width * a.height,
    );
    const fileId = sorted[0]?.file_id;
    if (fileId) out.push({ kind: "photo", fileId });
  }
  const doc = message.document;
  const hasNativeVideo = Boolean(message.video?.file_id);
  if (doc?.file_id && !hasNativeVideo) {
    const mime = (doc.mime_type || "").toLowerCase();
    const name = (doc.file_name || "").toLowerCase();
    if (mime.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name)) {
      out.push({ kind: "photo", fileId: doc.file_id, mime });
    } else if (mime.startsWith("video/") || /\.(mp4|mov|webm)$/.test(name)) {
      out.push({ kind: "video", fileId: doc.file_id, mime });
    }
  }
  if (message.video?.file_id) {
    out.push({
      kind: "video",
      fileId: message.video.file_id,
      mime: message.video.mime_type,
      durationSec: message.video.duration,
    });
  }
  for (const url of extractAllHttpUrls(text)) {
    out.push({ kind: "url", url });
  }
  return out;
}

export async function handleTiktokDraftMessage(input: {
  chatId: number;
  userId: number;
  text: string;
  cmd: string;
  message: NonNullable<TelegramUpdate["message"]>;
}): Promise<boolean> {
  const draft = await getActiveTiktokDraft(input.chatId);
  if (!draft) return false;

  if (draft.step === "awaiting_url") {
    const url = extractHttpUrl(input.text);
    if (!url) {
      await telegramSendMessage(
        input.chatId,
        "J’attends le lien de l’article (http/https).\n/tiktok_cancel pour abandonner.",
      );
      return true;
    }
    await setTiktokDraftSourceUrl(input.chatId, url);
    await telegramSendMessage(input.chatId, `Lien reçu.\n\n${mediaHint()}`);
    return true;
  }

  const extras = extraFromTelegramMessage(input.message, input.text);
  if (extras.length === 0) {
    await telegramSendMessage(
      input.chatId,
      [
        "Envoie un extrait vidéo ou une photo (dans l’ordre du montage).",
        mediaRoll(draft.extraMedia),
        "/tiktok_undo · /tiktok_go · /tiktok_cancel",
      ].join("\n"),
    );
    return true;
  }

  if (draft.extraMedia.length >= TIKTOK_USER_MEDIA_MAX) {
    await telegramSendMessage(
      input.chatId,
      `Maximum ${TIKTOK_USER_MEDIA_MAX} plans. /tiktok_undo ou /tiktok_go.`,
    );
    return true;
  }

  let updated = draft;
  for (const media of extras) {
    if (media.kind === "url" && media.url === draft.sourceUrl) continue;
    const next = await addTiktokDraftMedia(input.chatId, media);
    if (next) updated = next;
  }
  const n = updated.extraMedia.length;
  const ideal =
    n < 12
      ? `Idéal : 12–16 plans pour 1 min 10. Encore, /tiktok_undo, ou /tiktok_go.`
      : `Ça suffit pour monter. Encore, /tiktok_undo, ou /tiktok_go.`;
  await telegramSendMessage(
    input.chatId,
    [`Plan ${n}/${TIKTOK_USER_MEDIA_MAX} ajouté.`, mediaRoll(updated.extraMedia), ideal].join(
      "\n",
    ),
  );
  return true;
}

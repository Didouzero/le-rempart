import { after, NextRequest, NextResponse } from "next/server";
import { extractHeadlineFromCreative } from "@/lib/extract-headline";
import { isFacebookConfigured } from "@/lib/facebook";
import { prisma } from "@/lib/prisma";
import {
  deletePublishDraft,
  extractHttpUrl,
  getActivePublishDraft,
  upsertPublishDraft,
} from "@/lib/publish-draft";
import {
  publishCreativePipeline,
  telegramNotifier,
} from "@/lib/publish-pipeline";
import {
  isTelegramUserAllowed,
  pickLargestPhoto,
  telegramAnswerCallbackQuery,
  telegramDownloadFile,
  telegramSendMessage,
  type TelegramUpdate,
} from "@/lib/telegram";
import {
  handleVeilleApprovalCommand,
  handleVeilleCallback,
} from "@/lib/veille/approve";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Normalise `/veille_on@MonBot` → `/veille_on`. */
function normalizeCommand(text: string): string {
  const raw = text.trim().split(/\s+/)[0] || "";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.toLowerCase().replace(/@\w+$/i, "");
}

function commandsHelpText(): string {
  return [
    "📘 COMMANDES LE REMPART",
    "",
    "── Manuel (toujours dispo) ──",
    "1) Envoie une créative PNG/JPG",
    "2) Le bot demande le lien de l’article source",
    "3) Tu envoies l’URL → article site + Facebook",
    "/cancel — annuler la créative en attente de lien",
    "",
    "── Veille auto ──",
    "/veille_on — active l’agent (1 créneau/jour ~8h Paris, limite Hobby Vercel)",
    "/veille_off — coupe l’agent (manuel seul)",
    "/veille — statut (+ créative en attente si besoin)",
    "",
    "── Validation d’une créative auto ──",
    "/veille_ok — publier la proposition en attente",
    "/veille_non — refuser (nouvelle proposition, max 3/créneau)",
    "Boutons ✅ / ❌ sous la photo = même effet",
    "",
    "── Autres ──",
    "/fb — tester la connexion Facebook",
    "/fb_retry — republier le dernier article sur Facebook",
    "/fb_retry 69 — republier l’article #69 sur Facebook",
    "/id — afficher ton user id Telegram",
    "/help ou /commandes — cette liste",
    "",
    "Veille auto : 1×/jour vers 8h (heure FR) — plan Vercel Hobby.",
    "Rien n’est publié en auto sans ton OK.",
  ].join("\n");
}

type ClaimResult = "claimed" | "duplicate" | "db_down";

/** Claim update_id — si déjà vu, ignore (coupe les retries Telegram). */
async function claimUpdate(updateId: number): Promise<ClaimResult> {
  try {
    await prisma.telegramUpdateLog.create({
      data: { updateId: BigInt(updateId) },
    });
    return "claimed";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    // Prisma P2002 = unique constraint → vrai doublon Telegram
    if (code === "P2002" || /unique constraint/i.test(msg)) {
      return "duplicate";
    }
    console.error("telegram claimUpdate DB error", err);
    return "db_down";
  }
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  // Boutons inline ✅ / ❌ sur les créatives veille
  if (update.callback_query) {
    const cq = update.callback_query;
    if (cq.from?.is_bot) return;
    const userId = cq.from.id;
    const chatId = cq.message?.chat.id;
    if (!chatId) return;

    if (!isTelegramUserAllowed(userId)) {
      await telegramAnswerCallbackQuery(cq.id, "Non autorisé");
      return;
    }

    const data = cq.data || "";
    const handled = await handleVeilleCallback(data, chatId, cq.id);
    if (!handled) {
      await telegramAnswerCallbackQuery(cq.id);
    }
    return;
  }

  const message = update.message;
  if (!message?.from || !message.chat) return;
  if ((message.from as { is_bot?: boolean }).is_bot) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = (message.text || "").trim();
  const cmd = text ? normalizeCommand(text) : "";

  try {
    if (cmd === "/start" || cmd === "/id") {
      await telegramSendMessage(
        chatId,
        [
          "Bot Le Rempart prêt.",
          "",
          `Ton user id Telegram : ${userId}`,
          "",
          "Flux manuel :",
          "1) Envoie ta créative Canva (PNG/JPG)",
          "2) Envoie le lien de l’article source",
          "3) Je publie l’article site + Facebook",
          "",
          "/cancel pour abandonner une créative en attente.",
        ].join("\n"),
      );
      return;
    }

    if (cmd === "/help" || cmd === "/commandes" || cmd === "/cmds") {
      await telegramSendMessage(chatId, commandsHelpText());
      return;
    }

    if (
      cmd === "/cancel" ||
      cmd === "/annuler" ||
      text.toLowerCase() === "annuler"
    ) {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }
      const deleted = await deletePublishDraft(chatId);
      await telegramSendMessage(
        chatId,
        deleted
          ? "Brouillon annulé. Renvoie une créative quand tu veux."
          : "Aucun brouillon en attente.",
      );
      return;
    }

    if (
      cmd === "/veille_off" ||
      cmd === "/veille_on" ||
      cmd === "/veille" ||
      cmd === "/veille_status" ||
      cmd === "/veille_ok" ||
      cmd === "/veille_non"
    ) {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }

      if (await handleVeilleApprovalCommand(cmd, chatId)) {
        return;
      }

      const {
        isVeilleEnabled,
        setVeilleEnabled,
      } = await import("@/lib/veille/settings");

      if (cmd === "/veille_off") {
        await setVeilleEnabled(false);
        await telegramSendMessage(
          chatId,
          [
            "Veille : OFF.",
            "L’agent auto est arrêté.",
            "Tu peux toujours envoyer une créative manuelle (PNG/JPG).",
          ].join("\n"),
        );
        return;
      }
      if (cmd === "/veille_on") {
        await setVeilleEnabled(true);
        await telegramSendMessage(
          chatId,
          [
            "Veille : ON.",
            "1 proposition/jour vers 8h (heure FR) — limite plan Hobby Vercel.",
            "Chaque créative attend ton OK (/veille_ok) — max 3 essais si tu refuses.",
            "Le manuel (créative puis lien source) reste toujours possible.",
          ].join("\n"),
        );
        return;
      }
      const on = await isVeilleEnabled();
      const { getLatestPendingVeille } = await import("@/lib/veille/approve");
      const pending = await getLatestPendingVeille();
      const pendingLine = pending
        ? `\n\n⏳ 1 créative en attente → /veille_ok ou /veille_non`
        : "";
      await telegramSendMessage(
        chatId,
        (on
          ? "Statut veille : ON\n→ auto aux créneaux + validation\n→ manuel toujours OK"
          : "Statut veille : OFF\n→ auto coupé\n→ manuel seul") + pendingLine,
      );
      return;
    }

    if (cmd === "/fb" || cmd === "/facebook") {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }
      if (!isFacebookConfigured()) {
        await telegramSendMessage(
          chatId,
          "Facebook non configuré sur Vercel (FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN).",
        );
        return;
      }
      try {
        const { assertFacebookPageToken } = await import("@/lib/facebook");
        const page = await assertFacebookPageToken();
        await telegramSendMessage(
          chatId,
          `Facebook OK.\nPage : ${page.name}\nID : ${page.id}`,
        );
      } catch (err) {
        await telegramSendMessage(
          chatId,
          `Facebook KO — ${err instanceof Error ? err.message : "token invalide"}`,
        );
      }
      return;
    }

    if (
      cmd === "/fb_retry" ||
      cmd === "/facebook_retry" ||
      cmd === "/fbretry"
    ) {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }
      const parts = text.trim().split(/\s+/);
      const maybeId = parts[1] ? Number(parts[1]) : NaN;
      const publicId =
        Number.isFinite(maybeId) && maybeId > 0 ? Math.floor(maybeId) : undefined;

      try {
        const { republishArticleToFacebook } = await import(
          "@/lib/facebook-retry"
        );
        await republishArticleToFacebook({
          publicId,
          notify: telegramNotifier(chatId),
        });
      } catch (err) {
        await telegramSendMessage(
          chatId,
          `❌ /fb_retry : ${err instanceof Error ? err.message : "échec"}`,
        );
      }
      return;
    }

    if (!isTelegramUserAllowed(userId)) {
      await telegramSendMessage(
        chatId,
        `Accès non autorisé.\nTon id : ${userId}`,
      );
      return;
    }

    let fileId: string | null = null;
    if (message.photo?.length) {
      fileId = pickLargestPhoto(message.photo);
    } else if (
      message.document?.mime_type?.startsWith("image/") &&
      message.document.file_id
    ) {
      fileId = message.document.file_id;
    }

    const manualCaption = (message.caption || "").trim();

    // ── Étape 1 : créative → stocke brouillon, demande le lien ──
    if (fileId) {
      await telegramSendMessage(chatId, "Créative reçue. Lecture du titre…");
      const image = await telegramDownloadFile(fileId);

      let headline = manualCaption;
      if (!headline) {
        headline = await extractHeadlineFromCreative(image);
        await telegramSendMessage(chatId, `Titre détecté : ${headline}`);
      }

      await upsertPublishDraft({
        chatId,
        userId,
        headline,
        image,
      });

      await telegramSendMessage(
        chatId,
        [
          "Envoie maintenant le lien de l’article source (URL http/https).",
          "Je m’en sers pour rédiger l’article + le flash Facebook.",
          "",
          "/cancel pour annuler.",
        ].join("\n"),
      );
      return;
    }

    // ── Étape 2 : URL alors qu’un brouillon attend ──
    const draft = await getActivePublishDraft(chatId);
    const sourceUrl = text ? extractHttpUrl(text) : null;

    if (draft && sourceUrl) {
      await telegramSendMessage(
        chatId,
        `Lien reçu. Publication en cours…\n${sourceUrl}`,
      );

      try {
        await publishCreativePipeline({
          caption: draft.headline,
          headline: draft.headline,
          sourceUrl,
          image: { buffer: draft.imageData, mime: draft.imageMime },
          requireSource: true,
          notify: telegramNotifier(chatId),
        });
        await deletePublishDraft(chatId);
      } catch (err) {
        // Garde le brouillon pour renvoyer une autre URL
        throw err;
      }
      return;
    }

    if (draft && !sourceUrl) {
      await telegramSendMessage(
        chatId,
        [
          "J’attends encore le lien de la source (URL complète http/https).",
          `Titre en attente : ${draft.headline.slice(0, 120)}`,
          "",
          "/cancel pour annuler.",
        ].join("\n"),
      );
      return;
    }

    await telegramSendMessage(
      chatId,
      "Envoie d’abord une créative en image (PNG/JPG), puis le lien source.",
    );
  } catch (err) {
    console.error("telegram process error", err);
    try {
      await telegramSendMessage(
        chatId,
        `Erreur : ${err instanceof Error ? err.message : "échec publication"}`,
      );
    } catch {
      // ignore
    }
  }
}

export async function POST(request: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const claim = await claimUpdate(update.update_id);

  if (claim === "duplicate") {
    return NextResponse.json({ ok: true });
  }

  if (claim === "db_down") {
    // Neon/DB down ≠ doublon. 503 → Telegram garde l'update et retentera.
    console.error("telegram webhook: database unavailable, returning 503");
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 },
    );
  }

  after(() => processUpdate(update));
  return NextResponse.json({ ok: true });
}

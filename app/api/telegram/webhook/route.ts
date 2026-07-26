import { after, NextRequest, NextResponse } from "next/server";
import { extractHeadlineFromCreative } from "@/lib/extract-headline";
import { isFacebookConfigured } from "@/lib/facebook";
import { prisma } from "@/lib/prisma";
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

/** Claim update_id — si déjà vu, ignore (coupe les retries Telegram). */
async function claimUpdate(updateId: number): Promise<boolean> {
  try {
    await prisma.telegramUpdateLog.create({
      data: { updateId: BigInt(updateId) },
    });
    return true;
  } catch {
    return false;
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
          "Envoie juste ta créative Canva (PNG/JPG).",
          "Je lis le titre sur l'image, je trouve une photo web pour le site,",
          "je publie l'article + Facebook (créative).",
        ].join("\n"),
      );
      return;
    }

    if (cmd === "/help") {
      await telegramSendMessage(
        chatId,
        [
          "Envoie une image Canva (PNG/JPG).",
          "/fb — tester Facebook",
          "/veille_off — couper la créative auto",
          "/veille_on — réactiver la créative auto",
          "/veille — statut de la veille",
          "/veille_ok — valider la créative auto en attente",
          "/veille_non — refuser la créative auto (rien n'est posté)",
        ].join("\n"),
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
          "Veille / créative auto : OFF.\nPlus aucune publication automatique.",
        );
        return;
      }
      if (cmd === "/veille_on") {
        await setVeilleEnabled(true);
        await telegramSendMessage(
          chatId,
          "Veille / créative auto : ON.\nLe cron proposera une créative aux créneaux 8h–20h (validation Telegram obligatoire).",
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
          ? "Statut veille : ON (propositions auto + validation Telegram)."
          : "Statut veille : OFF (créative auto coupée).") + pendingLine,
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

    if (!fileId) {
      await telegramSendMessage(
        chatId,
        "Envoie une créative en image (PNG/JPG).",
      );
      return;
    }

    await telegramSendMessage(
      chatId,
      "Créative reçue. Lecture du titre + recherche d'illustration…",
    );

    const image = await telegramDownloadFile(fileId);

    let caption = manualCaption;
    if (!caption) {
      caption = await extractHeadlineFromCreative(image);
      await telegramSendMessage(chatId, `Titre détecté : ${caption}`);
    }

    await publishCreativePipeline({
      caption,
      image,
      notify: telegramNotifier(chatId),
    });
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

  const claimed = await claimUpdate(update.update_id);
  if (claimed) {
    after(() => processUpdate(update));
  }

  return NextResponse.json({ ok: true });
}

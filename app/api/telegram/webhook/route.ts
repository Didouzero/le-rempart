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

function commandsHelpText(): string {
  return [
    "📘 COMMANDES LE REMPART",
    "",
    "── Manuel (toujours dispo, veille ON ou OFF) ──",
    "Envoie une créative PNG/JPG → article site (+ Facebook si API ON)",
    "",
    "── Veille auto ──",
    "/veille_on — active l’agent (7 créneaux/jour, 8h–20h Paris)",
    "/veille_off — coupe l’agent (manuel seul)",
    "/veille — statut (+ créative en attente si besoin)",
    "",
    "── Validation d’une créative auto ──",
    "/veille_ok — publier la proposition en attente",
    "/veille_non — refuser (nouvelle proposition, max 3/créneau)",
    "Boutons ✅ / ❌ sous la photo = même effet",
    "",
    "── Facebook ──",
    "/fb — statut API + test token",
    "/fb_off — coupe la pub Facebook auto (recommandé si Meta bloque)",
    "/fb_on — réactive la pub Facebook auto",
    "/fb_retry [n°] — republier un article via API (si ON)",
    "",
    "── Autres ──",
    "/id — afficher ton user id Telegram",
    "/help ou /commandes — cette liste",
    "",
    "Créneaux veille : 8h, 10h, 12h, 14h, 16h, 18h, 20h (heure FR).",
    "Rien n’est publié en auto sans ton OK.",
  ].join("\n");
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

    if (cmd === "/help" || cmd === "/commandes" || cmd === "/cmds") {
      await telegramSendMessage(chatId, commandsHelpText());
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
            "7 propositions/jour (8h, 10h, 12h, 14h, 16h, 18h, 20h heure FR).",
            "Chaque créative attend ton OK (/veille_ok) — max 3 essais si tu refuses.",
            "Le manuel (envoi PNG/JPG) reste toujours possible.",
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

    if (
      cmd === "/fb" ||
      cmd === "/facebook" ||
      cmd === "/fb_on" ||
      cmd === "/fb_off" ||
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

      const {
        isFacebookPublishEnabled,
        setFacebookPublishEnabled,
      } = await import("@/lib/facebook-settings");

      if (cmd === "/fb_off") {
        await setFacebookPublishEnabled(false);
        await telegramSendMessage(
          chatId,
          "Facebook API : OFF.\nLes créatives Telegram → article site seulement.\nTu postes FB à la main.",
        );
        return;
      }

      if (cmd === "/fb_on") {
        await setFacebookPublishEnabled(true);
        await telegramSendMessage(
          chatId,
          "Facebook API : ON.\nProchaine créative tentera aussi le post Page.\nSi Meta bloque encore → /fb_off.",
        );
        return;
      }

      if (
        cmd === "/fb_retry" ||
        cmd === "/facebook_retry" ||
        cmd === "/fbretry"
      ) {
        const parts = text.trim().split(/\s+/);
        const maybeId = parts[1] ? Number(parts[1]) : NaN;
        const publicId =
          Number.isFinite(maybeId) && maybeId > 0
            ? Math.floor(maybeId)
            : undefined;

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

      // /fb — statut
      const publishOn = await isFacebookPublishEnabled();
      if (!isFacebookConfigured()) {
        await telegramSendMessage(
          chatId,
          [
            `Pub API : ${publishOn ? "ON" : "OFF"}`,
            "Facebook non configuré sur Vercel (FACEBOOK_PAGE_ID + TOKEN).",
          ].join("\n"),
        );
        return;
      }
      try {
        const { assertFacebookPageToken } = await import("@/lib/facebook");
        const page = await assertFacebookPageToken();
        await telegramSendMessage(
          chatId,
          [
            `Pub API : ${publishOn ? "ON" : "OFF"}`,
            `Token : OK`,
            `Page : ${page.name}`,
            `ID : ${page.id}`,
            "",
            publishOn
              ? "Les créatives tentent le post FB auto."
              : "Poste FB à la main. /fb_on pour réactiver l’API.",
          ].join("\n"),
        );
      } catch (err) {
        await telegramSendMessage(
          chatId,
          [
            `Pub API : ${publishOn ? "ON" : "OFF"}`,
            `Token : KO — ${err instanceof Error ? err.message : "invalide"}`,
          ].join("\n"),
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

import { after, NextRequest, NextResponse } from "next/server";
import { extractHeadlineFromCreative } from "@/lib/extract-headline";
import { buildFlashInfoText } from "@/lib/flash-info";
import {
  isFacebookConfigured,
  postCreativeToFacebookPage,
} from "@/lib/facebook";
import { prisma } from "@/lib/prisma";
import { publishArticleFromCreative } from "@/lib/publish-from-creative";
import {
  isTelegramUserAllowed,
  pickLargestPhoto,
  telegramDownloadFile,
  telegramSendMessage,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 90;

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
  const message = update.message;
  if (!message?.from || !message.chat) return;
  if ((message.from as { is_bot?: boolean }).is_bot) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = (message.text || "").trim();

  try {
    if (text === "/start" || text === "/id") {
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

    if (text === "/help") {
      await telegramSendMessage(
        chatId,
        "Envoie uniquement l'image Canva. Légende Telegram optionnelle.\n/fb — tester le token Facebook.",
      );
      return;
    }

    if (text === "/fb" || text === "/facebook") {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(chatId, `Accès non autorisé.\nTon id : ${userId}`);
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
      await telegramSendMessage(
        chatId,
        `Titre détecté : ${caption}\nRédaction en cours…`,
      );
    }

    const article = await publishArticleFromCreative({
      caption,
      image,
    });

    const coverLine = article.coverImageUrl
      ? "Illustration site : photo web trouvée."
      : "Illustration site : aucune photo web trouvée.";

    // Répondre tout de suite après publication site (ne pas bloquer sur Facebook)
    await telegramSendMessage(
      chatId,
      [
        "Article publié.",
        "",
        article.title,
        article.url,
        "",
        coverLine,
        "Facebook : envoi en cours…",
      ].join("\n"),
    );

    let facebookLine =
      "Facebook : non configuré (FACEBOOK_PAGE_ID + TOKEN).";

    if (isFacebookConfigured() && article.creative) {
      try {
        const flash = await buildFlashInfoText({
          title: article.title,
          excerpt: article.excerpt,
          articleUrl: article.url,
        });
        const { siteUrl } = await import("@/lib/publish-from-creative");
        const base = siteUrl().replace(
          "://le-rempart.org",
          "://www.le-rempart.org",
        );
        const imageUrl = `${base}/api/media/${article.id}`;

        const fb = await Promise.race([
          postCreativeToFacebookPage({
            imageUrl,
            caption: flash,
            commentLink: article.url.replace(
              "://le-rempart.org",
              "://www.le-rempart.org",
            ),
            image: article.creative,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Timeout Facebook (25s)")),
              25000,
            ),
          ),
        ]);
        facebookLine = `Facebook : publié (post ${fb.postId}).`;
      } catch (err) {
        console.error(err);
        facebookLine = `Facebook : échec — ${err instanceof Error ? err.message : "erreur"}`;
      }

      await telegramSendMessage(chatId, facebookLine);
    } else {
      await telegramSendMessage(chatId, facebookLine);
    }
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

  // Répondre tout de suite à Telegram (évite les retries / boucles)
  const claimed = await claimUpdate(update.update_id);
  if (claimed) {
    after(() => processUpdate(update));
  }

  return NextResponse.json({ ok: true });
}

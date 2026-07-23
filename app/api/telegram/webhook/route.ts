import { NextRequest, NextResponse } from "next/server";
import { extractHeadlineFromCreative } from "@/lib/extract-headline";
import { buildFlashInfoText } from "@/lib/flash-info";
import {
  isFacebookConfigured,
  postCreativeToFacebookPage,
} from "@/lib/facebook";
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

export async function POST(request: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.from || !message.chat) {
    return NextResponse.json({ ok: true });
  }

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
          "Je lis le titre sur l'image, je rédige l'article, je publie sur le site + Facebook.",
        ].join("\n"),
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/help") {
      await telegramSendMessage(
        chatId,
        "Envoie uniquement l'image Canva (titre déjà écrit dessus). Légende Telegram optionnelle.",
      );
      return NextResponse.json({ ok: true });
    }

    if (!isTelegramUserAllowed(userId)) {
      await telegramSendMessage(
        chatId,
        `Accès non autorisé.\nTon id : ${userId}\nAjoute-le dans TELEGRAM_ALLOWED_USER_IDS puis redeploy.`,
      );
      return NextResponse.json({ ok: true });
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
        "Envoie une créative en image (PNG/JPG). Le titre peut être écrit directement sur l'image.",
      );
      return NextResponse.json({ ok: true });
    }

    await telegramSendMessage(chatId, "Créative reçue. Lecture du titre sur l'image…");

    const image = await telegramDownloadFile(fileId);

    let caption = manualCaption;
    if (!caption) {
      caption = await extractHeadlineFromCreative(image);
      await telegramSendMessage(chatId, `Titre détecté : ${caption}\nRédaction en cours…`);
    } else {
      await telegramSendMessage(
        chatId,
        "Légende reçue. Rédaction, illustration et publication…",
      );
    }

    const article = await publishArticleFromCreative({
      caption,
      image,
    });

    let facebookLine =
      "Facebook : non configuré (ajoute FACEBOOK_PAGE_ID + TOKEN).";

    if (isFacebookConfigured() && article.creative) {
      try {
        const flash = await buildFlashInfoText({
          title: article.title,
          excerpt: article.excerpt,
          articleUrl: article.url,
        });
        const fb = await postCreativeToFacebookPage({
          image: article.creative,
          caption: flash,
          commentLink: article.url,
        });
        facebookLine = `Facebook : publié (post ${fb.postId}, com épinglé).`;
      } catch (err) {
        console.error(err);
        facebookLine = `Facebook : échec — ${err instanceof Error ? err.message : "erreur"}`;
      }
    }

    await telegramSendMessage(
      chatId,
      ["Article publié.", "", article.title, article.url, "", facebookLine].join(
        "\n",
      ),
    );
  } catch (err) {
    console.error("telegram webhook error", err);
    try {
      await telegramSendMessage(
        chatId,
        `Erreur : ${err instanceof Error ? err.message : "échec publication"}`,
      );
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}

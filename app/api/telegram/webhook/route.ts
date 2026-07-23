import { NextRequest, NextResponse } from "next/server";
import { publishArticleFromCreative } from "@/lib/publish-from-creative";
import {
  isTelegramUserAllowed,
  pickLargestPhoto,
  telegramDownloadFile,
  telegramSendMessage,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

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
          "1) Ajoute-le dans Vercel → Environment Variables → TELEGRAM_ALLOWED_USER_IDS",
          "2) Redeploy",
          "3) Envoie une créative (photo ou image) avec une légende / titre",
          "",
          "Je publierai l'article sur le site et je te renverrai le lien.",
        ].join("\n"),
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/help") {
      await telegramSendMessage(
        chatId,
        "Envoie une image Canva (créative) avec une légende = titre / brief. Je crée et publie l'article.",
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

    const caption = (message.caption || message.text || "").trim();

    if (!fileId && !caption) {
      await telegramSendMessage(
        chatId,
        "Envoie une créative (image) avec une légende, ou /help.",
      );
      return NextResponse.json({ ok: true });
    }

    if (!fileId) {
      await telegramSendMessage(
        chatId,
        "Pour l'instant j'ai besoin de la créative en image + légende.",
      );
      return NextResponse.json({ ok: true });
    }

    await telegramSendMessage(chatId, "Créative reçue. Rédaction et publication en cours…");

    const image = await telegramDownloadFile(fileId);
    const article = await publishArticleFromCreative({
      caption: caption || "Actualité",
      image,
    });

    await telegramSendMessage(
      chatId,
      [
        "Article publié.",
        "",
        article.title,
        article.url,
        "",
        "(Facebook : bientôt)",
      ].join("\n"),
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

import { after, NextRequest, NextResponse } from "next/server";
import { extractHeadlineFromCreative } from "@/lib/extract-headline";
import { buildFlashInfoText } from "@/lib/flash-info";
import {
  isFacebookConfigured,
  publishFacebookFeedPost,
  publishFacebookStory,
  commentArticleLinkOnPost,
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
export const maxDuration = 300;

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
      await telegramSendMessage(chatId, `Titre détecté : ${caption}`);
    }

    await telegramSendMessage(chatId, "Rédaction de l'article…");

    // publishArticleFromSource a ses propres timeouts + fallback Kimi :
    // ne plus tuer tout le flow à 70s avec une erreur sèche.
    const article = await publishArticleFromCreative({ caption, image });

    const coverLine = article.coverImageUrl
      ? "Illustration site : photo web trouvée."
      : "Illustration site : aucune photo web trouvée.";

    await telegramSendMessage(
      chatId,
      [
        "Article publié.",
        "",
        article.title,
        article.url,
        "",
        coverLine,
      ].join("\n"),
    );

    if (!isFacebookConfigured()) {
      await telegramSendMessage(
        chatId,
        "Facebook : non configuré (FACEBOOK_PAGE_ID + TOKEN).",
      );
      return;
    }

    if (!article.creative) {
      await telegramSendMessage(
        chatId,
        "Facebook : pas de créative à envoyer (image manquante).",
      );
      return;
    }

    await telegramSendMessage(chatId, "Facebook : rédaction du flash…");

    let flash: string;
    try {
      flash = await buildFlashInfoText({
        title: article.title,
        excerpt: article.excerpt,
        articleUrl: article.url,
      });
    } catch (flashErr) {
      console.error(flashErr);
      flash = `‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 — ${article.excerpt}`;
    }

    await telegramSendMessage(chatId, "Facebook : publication du post…");

    try {
      const { siteUrl } = await import("@/lib/publish-from-creative");
      const base = siteUrl().replace(
        "://le-rempart.org",
        "://www.le-rempart.org",
      );
      const imageUrl = `${base}/api/media/${article.id}`;
      const articleWww = article.url.replace(
        "://le-rempart.org",
        "://www.le-rempart.org",
      );

      const feed = await Promise.race([
        publishFacebookFeedPost({
          imageUrl,
          caption: flash,
          commentLink: articleWww,
          image: article.creative,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Timeout post Facebook (45s)")),
            45_000,
          ),
        ),
      ]);

      await telegramSendMessage(
        chatId,
        `✅ Post Facebook publié.\nID : ${feed.postId}`,
      );

      try {
        const commented = await commentArticleLinkOnPost({
          postId: feed.postId,
          articleUrl: articleWww,
          token: feed.token,
        });
        await telegramSendMessage(
          chatId,
          commented.pinned
            ? `✅ Lien article en commentaire (épinglé).\n${articleWww}`
            : `✅ Lien article en commentaire.\n${articleWww}`,
        );
      } catch (commentErr) {
        console.error(commentErr);
        await telegramSendMessage(
          chatId,
          `❌ Commentaire lien : échec\n${commentErr instanceof Error ? commentErr.message : "erreur"}`,
        );
      }

      await telegramSendMessage(chatId, "Facebook : publication de la story…");

      try {
        const storyId = await Promise.race([
          publishFacebookStory({
            imageUrl,
            image: article.creative,
            pageId: feed.pageId,
            token: feed.token,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Timeout story Facebook (40s)")),
              40_000,
            ),
          ),
        ]);
        await telegramSendMessage(
          chatId,
          `✅ Story Facebook publiée.\nID : ${storyId}`,
        );
      } catch (storyErr) {
        console.error(storyErr);
        await telegramSendMessage(
          chatId,
          `❌ Story Facebook : échec\n${storyErr instanceof Error ? storyErr.message : "erreur"}`,
        );
      }
    } catch (err) {
      console.error(err);
      await telegramSendMessage(
        chatId,
        `❌ Post Facebook : échec\n${err instanceof Error ? err.message : "erreur"}`,
      );
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

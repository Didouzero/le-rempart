import { buildFlashInfoText } from "@/lib/flash-info";
import {
  commentArticleLinkOnPost,
  isFacebookConfigured,
  publishFacebookFeedPost,
  publishFacebookStory,
} from "@/lib/facebook";
import { publishArticleFromCreative } from "@/lib/publish-from-creative";
import { telegramSendMessage } from "@/lib/telegram";

export type PipelineNotify = (text: string) => Promise<void>;

export type CreativePipelineResult = {
  article: Awaited<ReturnType<typeof publishArticleFromCreative>>;
  facebook: {
    postId?: string;
    storyId?: string | null;
    commentOk?: boolean;
    error?: string;
  };
};

/**
 * Pipeline partagé : article site + Facebook (post, commentaire lien, story).
 * Utilisé par le webhook Telegram et la veille auto.
 */
export async function publishCreativePipeline(input: {
  caption: string;
  image: { buffer: Buffer; mime: string };
  notify?: PipelineNotify;
}): Promise<CreativePipelineResult> {
  const notify = input.notify || (async () => {});

  await notify("Rédaction de l'article…");
  const article = await publishArticleFromCreative({
    caption: input.caption,
    image: input.image,
  });

  const coverLine = article.coverImageUrl
    ? "Illustration site : photo web trouvée."
    : "Illustration site : aucune photo web trouvée.";

  await notify(
    ["Article publié.", "", article.title, article.url, "", coverLine].join(
      "\n",
    ),
  );

  const facebook: CreativePipelineResult["facebook"] = {};

  if (!isFacebookConfigured()) {
    await notify("Facebook : non configuré (FACEBOOK_PAGE_ID + TOKEN).");
    facebook.error = "non configuré";
    return { article, facebook };
  }

  if (!article.creative) {
    await notify("Facebook : pas de créative à envoyer (image manquante).");
    facebook.error = "pas de créative";
    return { article, facebook };
  }

  await notify("Facebook : rédaction du flash…");
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

  await notify("Facebook : publication du post…");

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

    facebook.postId = feed.postId;
    await notify(`✅ Post Facebook publié.\nID : ${feed.postId}`);

    try {
      const commented = await commentArticleLinkOnPost({
        postId: feed.postId,
        articleUrl: articleWww,
        token: feed.token,
      });
      facebook.commentOk = true;
      await notify(
        commented.pinned
          ? `✅ Lien article en commentaire (épinglé).\n${articleWww}`
          : `✅ Lien article en commentaire.\n${articleWww}`,
      );
    } catch (commentErr) {
      console.error(commentErr);
      facebook.commentOk = false;
      await notify(
        `❌ Commentaire lien : échec\n${commentErr instanceof Error ? commentErr.message : "erreur"}`,
      );
    }

    await notify("Facebook : publication de la story…");

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
      facebook.storyId = storyId;
      await notify(`✅ Story Facebook publiée.\nID : ${storyId}`);
    } catch (storyErr) {
      console.error(storyErr);
      facebook.storyId = null;
      await notify(
        `❌ Story Facebook : échec\n${storyErr instanceof Error ? storyErr.message : "erreur"}`,
      );
    }
  } catch (err) {
    console.error(err);
    facebook.error = err instanceof Error ? err.message : "erreur";
    await notify(
      `❌ Post Facebook : échec\n${err instanceof Error ? err.message : "erreur"}`,
    );
  }

  return { article, facebook };
}

/** Notifier un chat Telegram (helper pour pipeline). */
export function telegramNotifier(chatId: number): PipelineNotify {
  return (text) => telegramSendMessage(chatId, text);
}

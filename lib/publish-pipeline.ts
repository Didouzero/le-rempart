import { buildFlashInfoText } from "@/lib/flash-info";
import {
  commentArticleLinkOnPost,
  isFacebookActionBlocked,
  isFacebookConfigured,
  publishFacebookFeedPost,
  publishFacebookStory,
} from "@/lib/facebook";
import { isFacebookPublishEnabled } from "@/lib/facebook-settings";
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

export async function publishFacebookForArticle(input: {
  articleId: string;
  title: string;
  excerpt: string;
  articleUrl: string;
  creative: { buffer: Buffer; mime: string };
  notify: PipelineNotify;
}): Promise<CreativePipelineResult["facebook"]> {
  const facebook: CreativePipelineResult["facebook"] = {};
  const { siteUrl } = await import("@/lib/publish-from-creative");
  const base = siteUrl().replace(
    "://le-rempart.org",
    "://www.le-rempart.org",
  );
  const imageUrl = `${base}/api/media/${input.articleId}`;
  const articleWww = input.articleUrl.replace(
    "://le-rempart.org",
    "://www.le-rempart.org",
  );

  await input.notify("Facebook : rédaction du flash…");
  let flash: string;
  try {
    flash = await buildFlashInfoText({
      title: input.title,
      excerpt: input.excerpt,
      articleUrl: articleWww,
    });
  } catch (flashErr) {
    console.error(flashErr);
    flash = `‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 — ${input.excerpt}`;
  }

  await input.notify("Facebook : publication du post…");

  try {
    const feed = await Promise.race([
      publishFacebookFeedPost({
        imageUrl,
        caption: flash,
        commentLink: articleWww,
        image: input.creative,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout post Facebook (45s)")),
          45_000,
        ),
      ),
    ]);

    facebook.postId = feed.postId;
    await input.notify(`✅ Post Facebook publié.\nID : ${feed.postId}`);

    try {
      const commented = await commentArticleLinkOnPost({
        postId: feed.postId,
        articleUrl: articleWww,
        token: feed.token,
      });
      facebook.commentOk = true;
      await input.notify(
        commented.pinned
          ? `✅ Lien article en commentaire (épinglé).\n${articleWww}`
          : `✅ Lien article en commentaire.\n${articleWww}`,
      );
    } catch (commentErr) {
      console.error(commentErr);
      facebook.commentOk = false;
      await input.notify(
        `❌ Commentaire lien : échec\n${
          commentErr instanceof Error ? commentErr.message : "erreur"
        }`,
      );
    }

    await input.notify("Facebook : publication de la story…");

    try {
      const storyId = await Promise.race([
        publishFacebookStory({
          imageUrl,
          image: input.creative,
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
      await input.notify(`✅ Story Facebook publiée.\nID : ${storyId}`);
    } catch (storyErr) {
      console.error(storyErr);
      facebook.storyId = null;
      await input.notify(
        `❌ Story Facebook : échec\n${
          storyErr instanceof Error ? storyErr.message : "erreur"
        }`,
      );
    }
  } catch (err) {
    console.error(err);
    facebook.error = err instanceof Error ? err.message : "erreur";
    const blocked = isFacebookActionBlocked(err);
    await input.notify(
      blocked
        ? `❌ Post Facebook : blocage anti-spam API (pas la Page).\nMeta freine les pubs automatiques un moment.\nAttends 1–2 h puis /fb_retry — n'insiste pas.\n\n${err instanceof Error ? err.message : "erreur"}`
        : `❌ Post Facebook : échec\n${
            err instanceof Error ? err.message : "erreur"
          }`,
    );
  }

  return facebook;
}

/**
 * Pipeline partagé : article site + Facebook (post, commentaire lien, story).
 * Utilisé par le webhook Telegram et la veille auto.
 */
export async function publishCreativePipeline(input: {
  caption: string;
  image: { buffer: Buffer; mime: string };
  /** URL source veille — entrée principale du Knowledge Builder. */
  sourceUrl?: string;
  sourceTitle?: string;
  headline?: string;
  notify?: PipelineNotify;
}): Promise<CreativePipelineResult> {
  const notify = input.notify || (async () => {});

  await notify(
    input.sourceUrl
      ? "Recherche documentaire (source veille) + rédaction…\n(peut prendre 2–4 min)"
      : "Recherche web + rédaction de l'article…\n(peut prendre 2–4 min, ne renvoie pas la créative)",
  );
  const article = await publishArticleFromCreative({
    caption: input.caption,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    headline: input.headline,
    image: input.image,
    notify,
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

  if (!(await isFacebookPublishEnabled())) {
    await notify(
      "Facebook API : OFF (pub manuelle).\nArticle site OK — poste la créative toi-même sur la Page.\n(/fb_on pour réactiver l’API plus tard)",
    );
    facebook.error = "désactivé";
    return { article, facebook };
  }

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

  const fb = await publishFacebookForArticle({
    articleId: article.id,
    title: article.title,
    excerpt: article.excerpt,
    articleUrl: article.url,
    creative: article.creative,
    notify,
  });

  return { article, facebook: fb };
}

/** Notifier un chat Telegram (helper pour pipeline). */
export function telegramNotifier(chatId: number): PipelineNotify {
  return (text) => telegramSendMessage(chatId, text);
}

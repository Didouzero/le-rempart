import { buildFlashInfoText } from "@/lib/flash-info";
import {
  commentArticleLinkOnPost,
  formatFacebookError,
  isFacebookActionBlocked,
  isFacebookConfigured,
  publishFacebookFeedPost,
  publishFacebookStory,
  FacebookGraphError,
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

export async function publishFacebookForArticle(input: {
  articleId: string;
  title: string;
  excerpt: string;
  articleUrl: string;
  creative: { buffer: Buffer; mime: string };
  /** Matière pour le flash Rempart (scrape / contenu article). */
  sourceText?: string | null;
  sourceUrl?: string | null;
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
      sourceText: input.sourceText || undefined,
      sourceUrl: input.sourceUrl || undefined,
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
    facebook.error = formatFacebookError(err);
    const blocked = isFacebookActionBlocked(err);
    const code =
      err instanceof FacebookGraphError ? err.code : undefined;
    const sub =
      err instanceof FacebookGraphError ? err.subcode : undefined;
    await input.notify(
      blocked
        ? [
            "❌ Post Facebook : blocage API Meta (code 368 / anti-spam token).",
            "Ce n'est PAS un quota mensuel, et PAS un lock de ta Page.",
            "Le post manuel marche parce qu'il utilise ton compte humain ;",
            "le bot utilise le token Graph (System User) — c'est LUI qui est freiné.",
            "",
            "À faire :",
            "1) Arrête /fb_retry (chaque essai rallonge le blocage).",
            "2) Attends 24–48h SANS aucun appel publish API,",
            "   OU régénère un Page Access Token (nouveau System User) dans Meta Business → mets à jour FACEBOOK_PAGE_ACCESS_TOKEN sur Vercel.",
            "",
            `Détail : ${formatFacebookError(err)}`,
            code != null ? `(code=${code}${sub != null ? ` subcode=${sub}` : ""})` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : `❌ Post Facebook : échec\n${formatFacebookError(err)}`,
    );
  }

  return facebook;
}

/**
 * Pipeline partagé : article site + Facebook (post, commentaire lien, story).
 * Flux manuel Telegram : sourceUrl obligatoire (créative → lien).
 */
export async function publishCreativePipeline(input: {
  caption: string;
  image: { buffer: Buffer; mime: string };
  /** URL source — obligatoire pour le flux manuel. */
  sourceUrl?: string;
  sourceTitle?: string;
  headline?: string;
  requireSource?: boolean;
  notify?: PipelineNotify;
}): Promise<CreativePipelineResult> {
  const notify = input.notify || (async () => {});
  const requireSource = input.requireSource ?? Boolean(input.sourceUrl);

  await notify(
    input.sourceUrl
      ? "Lecture source + petite recherche + rédaction…\n(environ 30–60 s)"
      : "Rédaction…",
  );
  const article = await publishArticleFromCreative({
    caption: input.caption,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    headline: input.headline,
    image: input.image,
    requireSource,
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

  const flashCorpus = [article.sourceText, article.content, article.excerpt]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);

  const fb = await publishFacebookForArticle({
    articleId: article.id,
    title: article.title,
    excerpt: article.excerpt,
    articleUrl: article.url,
    creative: article.creative,
    sourceText: flashCorpus,
    sourceUrl: article.sourceUrl,
    notify,
  });

  return { article, facebook: fb };
}

/** Notifier un chat Telegram (helper pour pipeline). */
export function telegramNotifier(chatId: number): PipelineNotify {
  return (text) => telegramSendMessage(chatId, text);
}

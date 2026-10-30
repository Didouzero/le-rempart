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
import {
  articleIssues,
  finishArticle,
  finishFlash,
  researchAndWrite,
  wrongWeekdays,
} from "@/lib/brief-writer";
import {
  publishArticleFromCreative,
  saveGeneratedArticle,
} from "@/lib/publish-from-creative";
import type { ArticleCategory } from "@/lib/categories";
import { purgeOldCreatives } from "@/lib/creatives-retention";
import { citedUrls, insertReadAlso, linkedArticleIds } from "@/lib/article-links";
import { prisma } from "@/lib/prisma";
import type { ReadyArticle } from "@/lib/ready-article";
import { chooseReadAlso } from "@/lib/read-also";
import { findLinkableArticles, findReadAlso } from "@/lib/related-articles";
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
  /** Accroche Canva = thèse du flash (prioritaire sur le titre site). */
  accroche?: string;
  excerpt: string;
  articleUrl: string;
  creative: { buffer: Buffer; mime: string };
  /** Matière pour le flash Rempart (scrape / contenu article). */
  sourceText?: string | null;
  sourceUrl?: string | null;
  researchNotes?: string | null;
  /** Flash déjà rédigé (moteur brief) : on saute la rédaction. */
  flash?: string;
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

  if (!input.flash) await input.notify("Facebook : recherche web + flash…");
  const flash = input.flash || await buildFlashInfoText({
    title: (input.accroche || input.title).trim(),
    excerpt: input.excerpt,
    sourceText: input.sourceText || undefined,
    sourceUrl: input.sourceUrl || undefined,
    articleUrl: articleWww,
    researchNotes: input.researchNotes || undefined,
    onRetry: (n, reason) =>
      input.notify(`Facebook : Kimi n’a pas fini (${reason}) — essai ${n}…`),
  });

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
  /** Directives « trouve des sources qui disent que… » (Telegram). */
  researchNotes?: string;
  /** URL illustration site (fournie après la créative). */
  coverImageUrl?: string;
  /** Fichier illustration Telegram (alternative à l’URL). */
  coverImage?: { buffer: Buffer; mime: string };
  requireSource?: boolean;
  notify?: PipelineNotify;
}): Promise<CreativePipelineResult> {
  const notify = input.notify || (async () => {});
  const requireSource = input.requireSource ?? Boolean(input.sourceUrl);
  const accroche = (input.headline || input.caption || "").trim();

  await notify(
    input.sourceUrl
      ? input.researchNotes?.trim()
        ? "Notes reçues + source + recherche web + rédaction…\n(environ 40–70 s)"
        : "Lecture source + recherche web (sens de l’accroche) + rédaction…\n(environ 30–60 s)"
      : "Rédaction…",
  );
  const article = await publishArticleFromCreative({
    caption: input.caption,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    headline: input.headline,
    researchNotes: input.researchNotes,
    coverImageUrl: input.coverImageUrl,
    coverImage: input.coverImage,
    image: input.image,
    requireSource,
    notify,
  });

  const coverLine = article.coverImageUrl
    ? input.coverImage
      ? "Illustration site : fichier enregistré."
      : input.coverImageUrl?.trim()
        ? "Illustration site : URL enregistrée."
        : "Illustration site : photo web trouvée."
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

  // Excerpt + article d'abord : sourceText scrapé est souvent un mur cookies.
  const flashCorpus = [article.excerpt, article.content, article.sourceText]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 8000);

  const fb = await publishFacebookForArticle({
    articleId: article.id,
    title: article.title,
    accroche: accroche || article.title,
    excerpt: article.excerpt,
    articleUrl: article.url,
    creative: article.creative,
    sourceText: flashCorpus,
    sourceUrl: article.sourceUrl,
    researchNotes: input.researchNotes,
    notify,
  });

  return { article, facebook: fb };
}

/**
 * Flux manuel Telegram : créative + illustration + brief libre de l'éditeur.
 * Kimi cherche lui-même ses sources, rédige le flash puis l'article (moteur Flambeau),
 * et tout est publié directement : article site, post Facebook, lien épinglé, story.
 */
export async function publishBriefPipeline(input: {
  headline: string;
  brief: string;
  image: { buffer: Buffer; mime: string };
  coverImageUrl?: string;
  coverImage?: { buffer: Buffer; mime: string };
  /** Légende de l'illustration (description et crédit). */
  coverCaption?: string;
  /** Rubrique choisie par l'éditeur dans le bot. */
  category?: ArticleCategory;
  notify?: PipelineNotify;
}): Promise<CreativePipelineResult> {
  const notify = input.notify || (async () => {});
  // Chaque publication fait aussi le ménage des créatives de plus de 24 h.
  await purgeOldCreatives().catch((err) => console.error("purge créatives", err));

  const linkable = await findLinkableArticles({
    text: `${input.headline} ${input.brief}`,
  }).catch((err) => {
    console.error("linkable articles skipped", err);
    return [];
  });

  const research = await researchAndWrite({
    headline: input.headline,
    brief: input.brief,
    creative: input.image,
    linkable,
    onProgress: notify,
    onSearch: (queries) =>
      queries.length
        ? notify(`🔎 ${queries.map((q) => `« ${q} »`).join(" · ")}`)
        : undefined,
  });

  const sourceList = research.sources
    .slice(0, 6)
    .map((s) => `• ${s.title} (${hostOf(s.url)})`)
    .join("\n");
  await notify(
    [`📝 Flash et article rédigés.`, sourceList && `📚 Sources :\n${sourceList}`]
      .filter(Boolean)
      .join("\n\n"),
  );
  if (research.warnings.length) {
    await notify(
      ["⚠️ À vérifier après publication :", ...research.warnings.map((w) => `• ${w}`)].join("\n"),
    );
  }

  // Encadré « À lire aussi » : présélection par noms propres, choix final par Opus.
  const readAlso = await findReadAlso({
    title: research.article.title,
    excerpt: research.article.excerpt,
    excludePublicIds: linkedArticleIds(research.article.content),
    take: 8,
  })
    .then((candidates) => chooseReadAlso(research.article, candidates))
    .catch((err) => {
      console.error("à lire aussi ignoré", err);
      return [];
    });

  const article = await saveGeneratedArticle({
    generated: {
      ...research.article,
      content: insertReadAlso(research.article.content, readAlso),
    },
    sourceText: research.matter,
    sourceUrl: research.sources[0]?.url,
    coverImageUrl: input.coverImageUrl,
    coverImage: input.coverImage,
    coverCaption: input.coverCaption,
    category: input.category,
    image: input.image,
    notify,
  });

  await notify(["Article publié.", "", article.title, article.url].join("\n"));

  if (!isFacebookConfigured()) {
    await notify("Facebook : non configuré (FACEBOOK_PAGE_ID + TOKEN).");
    return { article, facebook: { error: "non configuré" } };
  }
  if (!article.creative) {
    await notify("Facebook : pas de créative à envoyer (image manquante).");
    return { article, facebook: { error: "pas de créative" } };
  }

  const facebook = await publishFacebookForArticle({
    articleId: article.id,
    title: article.title,
    excerpt: article.excerpt,
    articleUrl: article.url,
    creative: article.creative,
    flash: research.flash,
    notify,
  });
  return { article, facebook };
}

/**
 * Article déjà rédigé par l'éditeur : mêmes vérifications de forme, même enregistrement
 * et même envoi Facebook que le flux habituel, sans recherche ni rédaction par Kimi.
 */
export async function publishReadyArticlePipeline(input: {
  ready: ReadyArticle;
  headline: string;
  image: { buffer: Buffer; mime: string };
  coverImageUrl?: string;
  coverImage?: { buffer: Buffer; mime: string };
  coverCaption?: string;
  category?: ArticleCategory;
  notify?: PipelineNotify;
}): Promise<CreativePipelineResult> {
  const notify = input.notify || (async () => {});
  const { ready } = input;
  const finished = finishArticle(ready, {
    external: new Set(citedUrls(ready.content)),
    internal: new Set(linkedArticleIds(ready.content)),
  });
  const flash = finishFlash(ready.flash);
  const issues = [...articleIssues(finished), ...wrongWeekdays(flash)];
  if (issues.length) {
    throw new Error(`Texte prêt à corriger : ${issues.join(" ; ")}`);
  }
  await purgeOldCreatives().catch((err) => console.error("purge créatives", err));

  const readAlso = ready.readAlsoIds.length
    ? await prisma.article.findMany({
        where: { publicId: { in: ready.readAlsoIds }, status: "published" },
        select: { publicId: true, title: true },
      })
    : [];

  const article = await saveGeneratedArticle({
    generated: { ...finished, content: insertReadAlso(finished.content, readAlso) },
    sourceText: `Article rédigé en séance par l'éditeur.\n\n${ready.content}`,
    coverImageUrl: input.coverImageUrl,
    coverImage: input.coverImage,
    coverCaption: input.coverCaption,
    category: input.category,
    image: input.image,
    notify,
  });
  await notify(["Article publié.", "", article.title, article.url].join("\n"));

  if (!isFacebookConfigured()) {
    await notify("Facebook : non configuré (FACEBOOK_PAGE_ID + TOKEN).");
    return { article, facebook: { error: "non configuré" } };
  }
  if (!article.creative) {
    await notify("Facebook : pas de créative à envoyer (image manquante).");
    return { article, facebook: { error: "pas de créative" } };
  }
  const facebook = await publishFacebookForArticle({
    articleId: article.id,
    title: article.title,
    excerpt: article.excerpt,
    articleUrl: article.url,
    creative: article.creative,
    flash,
    notify,
  });
  return { article, facebook };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Notifier un chat Telegram (helper pour pipeline). */
export function telegramNotifier(chatId: number): PipelineNotify {
  return (text) => telegramSendMessage(chatId, text);
}

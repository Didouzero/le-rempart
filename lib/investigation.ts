import { allocateNextAuthorName } from "@/lib/authors";
import {
  commentArticleLinkOnPost,
  formatFacebookError,
  isFacebookConfigured,
  publishFacebookFeedPost,
  publishFacebookStory,
} from "@/lib/facebook";
import { fetchSourceText } from "@/lib/fetch-source";
import { buildFlashInfoText } from "@/lib/flash-info";
import {
  extractAllHttpUrls,
  extractInvestigationFocus,
} from "@/lib/investigation-draft";
import { resolveRelevantCoverUrl } from "@/lib/openverse";
import { runEditorialPipeline } from "@/lib/pipeline/run-editorial-pipeline";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { slugify } from "@/lib/slug";
import { withTimeout } from "@/lib/with-timeout";

export const INVESTIGATION_COMMENT_PREFIX =
  "notre enquête complète est disponible pour nos abonnés payants juste ici : 👉";

async function uniqueDossierSlug(title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let i = 2;
  while (true) {
    const existing = await prisma.specialDossier.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

export async function scrapeInvestigationSources(
  urls: string[],
  onProgress?: (msg: string) => void | Promise<void>,
): Promise<{ primaryUrl: string; sourceText: string }> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { primaryUrl: "", sourceText: "" };
  }
  const chunks: string[] = [];
  for (const url of unique.slice(0, 10)) {
    await onProgress?.(`Lecture source : ${url.slice(0, 80)}`);
    try {
      const text = await fetchSourceText(url);
      if ((text?.trim().length || 0) >= 80) {
        chunks.push(`### SOURCE ${url}\n${text.slice(0, 8000)}`);
      }
    } catch (err) {
      console.error("investigation scrape", url, err);
    }
  }
  return {
    primaryUrl: unique[0] || "",
    sourceText: chunks.join("\n\n").slice(0, 28000),
  };
}

async function publishInvestigationFacebook(input: {
  title: string;
  excerpt: string;
  content: string;
  articleUrl: string;
  sourceText?: string;
  creative?: { buffer: Buffer; mime: string };
  notify: (text: string) => Promise<void>;
}): Promise<void> {
  const notify = input.notify;
  if (!isFacebookConfigured()) {
    await notify("Facebook : non configuré (FACEBOOK_PAGE_ID + TOKEN).");
    return;
  }
  if (!input.creative) {
    await notify("Facebook : pas de créative à envoyer.");
    return;
  }

  const articleWww = input.articleUrl.replace(
    "://le-rempart.org",
    "://www.le-rempart.org",
  );

  await notify("Facebook : rédaction du flash…");
  let flash: string;
  try {
    flash = await buildFlashInfoText({
      title: input.title,
      excerpt: input.excerpt,
      sourceText: [input.sourceText, input.content].filter(Boolean).join("\n\n"),
      articleUrl: articleWww,
    });
  } catch (err) {
    console.error("investigation flash", err);
    flash = `‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 — ${input.excerpt}`;
  }

  await notify("Facebook : publication du post…");
  try {
    const feed = await Promise.race([
      publishFacebookFeedPost({
        imageUrl: "https://www.le-rempart.org/favicon.png",
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

    await notify(`✅ Post Facebook publié.\nID : ${feed.postId}`);

    const commentBody = `${INVESTIGATION_COMMENT_PREFIX} ${articleWww}`;
    try {
      const commented = await commentArticleLinkOnPost({
        postId: feed.postId,
        articleUrl: articleWww,
        token: feed.token,
        message: commentBody,
        pin: true,
      });
      await notify(
        commented.pinned
          ? `✅ Lien enquête en commentaire (épinglé).\n${commentBody}`
          : `✅ Lien enquête en commentaire.\n${commentBody}`,
      );
    } catch (commentErr) {
      console.error("investigation fb comment", commentErr);
      await notify(
        `❌ Commentaire lien : échec\n${
          commentErr instanceof Error ? commentErr.message : "erreur"
        }`,
      );
    }

    await notify("Facebook : publication de la story…");
    try {
      const storyId = await Promise.race([
        publishFacebookStory({
          imageUrl: "https://www.le-rempart.org/favicon.png",
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
      await notify(`✅ Story Facebook publiée.\nID : ${storyId}`);
    } catch (storyErr) {
      console.error("investigation fb story", storyErr);
      await notify(
        `❌ Story Facebook : échec\n${
          storyErr instanceof Error ? storyErr.message : "erreur"
        }`,
      );
    }
  } catch (err) {
    console.error("investigation fb post", err);
    await notify(`❌ Post Facebook : échec\n${formatFacebookError(err)}`);
  }
}

export async function publishInvestigation(input: {
  prompt: string;
  headline?: string;
  creative?: { buffer: Buffer; mime: string };
  notify?: (text: string) => Promise<void>;
}): Promise<{ slug: string; title: string; url: string }> {
  const notify = input.notify || (async () => {});
  const prompt = input.prompt.trim();
  if (prompt.length < 40) {
    throw new Error(
      "Prompt trop court. Donne un brief complet : infos, liens, angle, directives de recherche.",
    );
  }

  const { subject, queries } = extractInvestigationFocus(prompt, input.headline);
  const urls = extractAllHttpUrls(prompt);

  await notify(
    `Sujet retenu : ${subject}\nRecherche autonome + lecture des liens du prompt.\nÇa peut prendre 3 à 8 minutes.`,
  );

  const scraped = await scrapeInvestigationSources(urls, notify);
  const briefSlice = prompt.slice(0, 60000);
  const scrapeBudget = Math.max(0, 80000 - briefSlice.length);
  const sourceText = [briefSlice, scraped.sourceText.slice(0, scrapeBudget)]
    .filter(Boolean)
    .join("\n\n");

  const pipeline = await runEditorialPipeline(
    {
      title: subject,
      caption: prompt.slice(0, 4000),
      sourceUrl: scraped.primaryUrl || urls[0] || undefined,
      extraSourceUrls: urls.slice(scraped.primaryUrl ? 1 : 0, 10),
      sourceText,
    },
    {
      maxResearchPasses: 3,
      fast: false,
      sourceFirst: false,
      investigation: true,
      extraQueries: queries,
      editorialBrief: briefSlice,
      researchTimeoutMs: 200_000,
      writingTimeoutMs: 140_000,
      onProgress: notify,
    },
  );

  const article = pipeline.artifacts.article;
  if (!article?.title || !article.content) {
    throw new Error("La rédaction de l’enquête n’a rien produit.");
  }

  await notify("Illustration site…");
  const cover = await withTimeout(
    resolveRelevantCoverUrl({
      title: article.title,
      excerpt: article.excerpt,
    }),
    28_000,
    "Timeout illustration",
  ).catch(() => null);

  const slug = await uniqueDossierSlug(article.title);
  const author = await allocateNextAuthorName();
  const datedContent = [
    article.content,
    "",
    `*Enquête Le Rempart — ${author}.*`,
  ].join("\n");

  await prisma.specialDossier.create({
    data: {
      slug,
      title: article.title,
      excerpt: article.excerpt.slice(0, 500),
      content: datedContent,
      coverImageUrl: cover,
      membersOnly: true,
      publishedAt: new Date(),
    },
  });

  const url = absoluteUrl(`/dossiers/${slug}`);
  await notify(`Enquête publiée (Rempart+).\n${article.title}\n${url}`);

  await publishInvestigationFacebook({
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    articleUrl: url,
    sourceText,
    creative: input.creative,
    notify,
  });

  return { slug, title: article.title, url };
}

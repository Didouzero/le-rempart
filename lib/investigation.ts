import { allocateNextAuthorName } from "@/lib/authors";
import { fetchSourceText } from "@/lib/fetch-source";
import { resolveRelevantCoverUrl } from "@/lib/openverse";
import { runEditorialPipeline } from "@/lib/pipeline/run-editorial-pipeline";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { slugify } from "@/lib/slug";
import { withTimeout } from "@/lib/with-timeout";

export type InvestigationDraft = {
  subject: string;
  urls: string[];
  coverImageUrl?: string | null;
};

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
    throw new Error("Au moins un lien de référence est requis.");
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
  if (chunks.length === 0) {
    throw new Error(
      "Impossible de lire les liens. Vérifie qu’ils ne sont pas derrière un paywall.",
    );
  }
  return {
    primaryUrl: unique[0]!,
    sourceText: chunks.join("\n\n").slice(0, 28000),
  };
}

export async function publishInvestigation(input: {
  subject: string;
  urls: string[];
  coverImageUrl?: string | null;
  notify?: (text: string) => Promise<void>;
}): Promise<{ slug: string; title: string; url: string }> {
  const notify = input.notify || (async () => {});
  const subject = input.subject.trim().slice(0, 280);
  if (subject.length < 8) {
    throw new Error("Sujet trop court. Ex. : Sébastien Delogu fins de mois");
  }

  await notify(
    "Enquête : lecture des sources + recherche approfondie.\nÇa peut prendre 3 à 8 minutes.",
  );

  const { primaryUrl, sourceText } = await scrapeInvestigationSources(
    input.urls,
    notify,
  );

  const extraQueries = [
    `${subject} patrimoine`,
    `${subject} indemnités député`,
    `${subject} déclaration HATVP`,
    `${subject} biographie`,
  ];

  const pipeline = await runEditorialPipeline(
    {
      title: subject,
      sourceUrl: primaryUrl,
      extraSourceUrls: input.urls.slice(1, 10),
      sourceText,
    },
    {
      maxResearchPasses: 3,
      fast: false,
      sourceFirst: false,
      investigation: true,
      extraQueries,
      researchTimeoutMs: 200_000,
      writingTimeoutMs: 140_000,
      onProgress: notify,
    },
  );

  const article = pipeline.artifacts.article;
  if (!article?.title || !article.content) {
    throw new Error("La rédaction de l’enquête n’a rien produit.");
  }

  await notify("Illustration…");
  const cover =
    input.coverImageUrl?.trim() ||
    (await withTimeout(
      resolveRelevantCoverUrl({
        title: article.title,
        excerpt: article.excerpt,
      }),
      28_000,
      "Timeout illustration",
    ).catch(() => null));

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
  return { slug, title: article.title, url };
}

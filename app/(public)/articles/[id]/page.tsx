import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { ArticleBody } from "@/components/ArticleBody";
import { Caption, captionText } from "@/components/CoverCaption";
import { CoverImg } from "@/components/CoverImg";
import { JsonLd } from "@/components/JsonLd";
import { NativeAdsRail } from "@/components/NativeAdsRail";
import { RelatedArticles } from "@/components/RelatedArticles";
import { ArticleViewBeacon } from "@/components/ArticleViewBeacon";
import { ShareButtons } from "@/components/ShareButtons";
import { PublishedAt } from "@/components/PublishedAt";
import { articleAuthorName, SITE_AUTHOR } from "@/lib/authors";
import { articlePublicPath, articlePublicUrl } from "@/lib/article-url";
import {
  categoryLabel,
  categoryPath,
  type ArticleCategory,
} from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { findRelatedArticles } from "@/lib/related-articles";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  newsArticleJsonLd,
  SITE_OG_IMAGE,
  SITE_NAME,
} from "@/lib/seo";
import { hostedIllustrationSize } from "@/lib/illustration-size";
import { articleTags, tagPath, type TagWithCount } from "@/lib/tags";

type Props = {
  params: Promise<{ id: string }>;
};

// Servie depuis le cache CDN : régénérée toutes les 5 minutes, ou aussitôt après
// une publication ou une correction (lib/revalidate-article.ts).
export const revalidate = 300;

/** Aucune page générée au build : chaque article est mis en cache à sa première visite. */
export function generateStaticParams() {
  return [];
}

type ArticleRow = {
  id: string;
  publicId: number;
  title: string;
  excerpt: string;
  content: string;
  authorName: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  coverImageUrl: string | null;
  coverCaption: string | null;
  category: ArticleCategory;
};

/** Mémorisée le temps d'un rendu : métadonnées et page partagent la même requête. */
const findByPublicId = cache(async function findByPublicId(
  publicId: number,
): Promise<ArticleRow | null> {
  return withDbTimeout(
    prisma.article.findFirst({
      where: { publicId, status: "published" },
      select: {
        id: true,
        publicId: true,
        title: true,
        excerpt: true,
        content: true,
        authorName: true,
        publishedAt: true,
        updatedAt: true,
        coverImageUrl: true,
        coverCaption: true,
        category: true,
      },
    }),
  );
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asNumber = Number(id);
  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    return { title: SITE_NAME };
  }
  const article = await findByPublicId(asNumber);
  if (!article) return { title: "Article introuvable" };

  const path = articlePublicPath(article.publicId);
  const url = articlePublicUrl(article.publicId);
  const imageUrl = article.coverImageUrl || absoluteUrl(SITE_OG_IMAGE);
  const section = categoryLabel(article.category);
  const author = articleAuthorName(article.authorName);
  const imageSize = hostedIllustrationSize(article.coverImageUrl, article.id);

  return {
    ...buildPageMetadata({
      title: article.title,
      description: article.excerpt,
      path,
      ogType: "article",
      image: imageUrl,
      imageAlt: article.title,
      imageSize,
    }),
    authors: [
      author === SITE_AUTHOR.name
        ? { name: author, url: absoluteUrl(SITE_AUTHOR.path) }
        : { name: author },
    ],
    // Le template ajoute déjà « — Le Rempart » ; OG title = titre seul + siteName
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      url,
      siteName: SITE_NAME,
      locale: "fr_FR",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      section,
      authors: [author],
      images: [{ url: imageUrl, alt: article.title, ...(imageSize ?? {}) }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [imageUrl],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const asNumber = Number(id);

  if (!Number.isInteger(asNumber) || asNumber <= 0) {
    const bySlug = await withDbTimeout(
      prisma.article.findFirst({
        where: { slug: id, status: "published" },
        select: { publicId: true },
      }),
    );
    if (bySlug) permanentRedirect(articlePublicPath(bySlug.publicId));
    notFound();
  }

  // Une panne de base lève une erreur : le cache garde la version précédente au lieu d'un 404.
  const article = await findByPublicId(asNumber);

  if (!article) {
    // Un 404 reste en cache plusieurs minutes, et Vercel peut le resservir après la
    // publication : Facebook lit alors une page d'erreur et l'aperçu du lien est
    // générique. Pour un numéro encore libre ou un article pas encore publié, on lève
    // une erreur, qui n'est jamais mise en cache. Seuls les quelques numéros qui suivent
    // le dernier article sont concernés : au-delà, un robot qui tâtonne reçoit un 404
    // et la Search Console ne compte pas d'erreurs serveur.
    const [row, latest] = await Promise.all([
      withDbTimeout(
        prisma.article.findUnique({ where: { publicId: asNumber }, select: { id: true } }),
      ),
      withDbTimeout(prisma.article.aggregate({ _max: { publicId: true } })),
    ]);
    const max = latest._max.publicId ?? 0;
    if (row || (asNumber > max && asNumber <= max + 5)) {
      throw new Error(`Article ${asNumber} pas encore publié`);
    }
    notFound();
  }

  let related: Awaited<ReturnType<typeof findRelatedArticles>> = [];
  try {
    related = await findRelatedArticles({
      excludeId: article.id,
      category: article.category,
      title: article.title,
      excerpt: article.excerpt,
    });
  } catch {
    related = [];
  }

  let tags: TagWithCount[] = [];
  try {
    tags = await articleTags(article.id);
  } catch {
    tags = [];
  }

  const url = articlePublicUrl(article.publicId);
  const section = categoryLabel(article.category);
  const rubriquePath = categoryPath(article.category);
  const author = articleAuthorName(article.authorName);
  const imageSize = hostedIllustrationSize(article.coverImageUrl, article.id);
  // Temps de lecture (230 mots par minute) et date de mise à jour, affichée
  // seulement pour une vraie correction, au moins une heure après la publication.
  const words = article.content.split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / 230));
  const updated =
    article.publishedAt &&
    article.updatedAt.getTime() - article.publishedAt.getTime() > 60 * 60 * 1000;

  return (
    <article className="animate-fade-up">
      <JsonLd
        data={newsArticleJsonLd({
          title: article.title,
          excerpt: article.excerpt,
          url,
          imageUrl: article.coverImageUrl,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          section,
          authorName: author,
          imageSize,
          tags: tags.map((t) => ({
            name: t.name,
            kind: t.kind,
            url: absoluteUrl(tagPath(t.slug)),
          })),
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Dernières news", path: "/" },
          { name: section, path: rubriquePath },
          { name: article.title, path: articlePublicPath(article.publicId) },
        ])}
      />

      {/* Colonne de lecture centrée : fil d'Ariane, titre, photo et texte alignés. */}
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          {/* La rubrique une seule fois, en surtitre ; la date est dans la signature. */}
          <p className="section-kicker">
            <span className="live-dot" aria-hidden />
            <Link
              href={rubriquePath}
              className="text-inherit no-underline hover:underline"
            >
              {section}
            </Link>
          </p>
          <h1 className="font-headline mt-4 text-[1.9rem] leading-[1.1] sm:text-[2.35rem] md:text-[2.75rem]">
            {article.title}
          </h1>
          <p className="article-standfirst mt-5">{article.excerpt}</p>

          {/* Signature : portrait, nom, fonction, dates et temps de lecture. */}
          <div className="mt-7 flex flex-col gap-4 border-y border-rule py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              {author === SITE_AUTHOR.name && SITE_AUTHOR.photo ? (
                <Link href={SITE_AUTHOR.path} rel="author" className="shrink-0" aria-label={author}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={SITE_AUTHOR.photo}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full border border-accent/60 object-cover"
                  />
                </Link>
              ) : null}
              <div className="min-w-0 leading-snug">
                <p className="text-[0.95rem] text-ink">
                  Par{" "}
                  {author === SITE_AUTHOR.name ? (
                    <Link
                      href={SITE_AUTHOR.path}
                      rel="author"
                      className="font-semibold text-ink no-underline hover:text-gold hover:underline"
                    >
                      {author}
                    </Link>
                  ) : (
                    <span className="font-semibold">{author}</span>
                  )}
                  {author === SITE_AUTHOR.name ? (
                    <span className="text-muted">, {SITE_AUTHOR.jobTitle.toLowerCase()}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[0.8rem] text-muted">
                  Publié le{" "}
                  <PublishedAt value={article.publishedAt} />
                  {updated ? (
                    <>
                      {" · "}Mis à jour le <PublishedAt value={article.updatedAt} />
                    </>
                  ) : null}
                  {" · "}
                  {readingMinutes} min de lecture
                </p>
              </div>
            </div>
            <ShareButtons url={url} title={article.title} compact />
          </div>
        </header>

        {article.coverImageUrl ? (
          <figure className="mb-10">
            {/* 16:9 comme les illustrations demandées (1600 × 900) : jamais rognée. */}
            <div className="media-frame aspect-[16/9] w-full shadow-[var(--shadow-soft)]">
              <CoverImg
                url={article.coverImageUrl}
                alt={
                  article.coverCaption
                    ? captionText(article.coverCaption)
                    : article.title
                }
                sizes="(min-width: 800px) 48rem, 100vw"
                priority
                className="h-full w-full object-cover"
              />
            </div>
            {article.coverCaption ? (
              <figcaption className="mt-2 text-sm italic text-muted">
                <Caption source={article.coverCaption} />
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        {/* Plus de colonnes de pub autour du texte : la lecture d'abord. */}
        <div className="article-dropcap">
          <ArticleBody
            content={article.content}
            showNewsletterCta
            showInArticleAd
          />
        </div>
        <footer className="mt-12 space-y-8">
          {tags.length > 0 ? (
            <nav aria-label="Sujets de l'article">
              <p className="section-kicker mb-3">Sujets</p>
              <ul className="flex list-none flex-wrap gap-2 p-0">
                {tags.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={tagPath(t.slug)}
                      className="inline-flex items-center rounded-lg border border-rule bg-card/60 px-3 py-1.5 text-[0.9rem] text-ink no-underline transition hover:border-accent hover:text-gold hover:no-underline"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <ShareButtons url={url} title={article.title} />

          {author === SITE_AUTHOR.name ? (
            <aside
              aria-label="L'auteur"
              className="flex gap-4 rounded-lg border border-rule bg-card/60 p-5 sm:p-6"
            >
              {SITE_AUTHOR.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={SITE_AUTHOR.photo}
                  alt={SITE_AUTHOR.name}
                  width={72}
                  height={72}
                  className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border border-accent/60 object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-display text-[0.8rem] tracking-[0.16em] text-gold">
                  L&apos;auteur
                </p>
                <p className="font-headline mt-1 text-xl text-ink">{SITE_AUTHOR.name}</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{SITE_AUTHOR.bio}</p>
                <Link
                  href={SITE_AUTHOR.path}
                  rel="author"
                  className="font-display mt-3 inline-flex items-center gap-1.5 text-[0.85rem] tracking-[0.12em] text-gold no-underline hover:underline"
                >
                  Tous ses articles <span aria-hidden>→</span>
                </Link>
              </div>
            </aside>
          ) : null}
        </footer>
        <ArticleViewBeacon publicId={article.publicId} />
      </div>

      {/* Nos articles d'abord, les contenus sponsorisés ensuite. */}
      <RelatedArticles articles={related} />

      <AdSlot slot="article-bottom" />

      <NativeAdsRail />
    </article>
  );
}

import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { TagKind } from "@prisma/client";
import { ArticleCard } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
import { articlePublicPath } from "@/lib/article-url";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  ORGANIZATION_ID,
  SITE_NAME,
} from "@/lib/seo";
import { TAG_INDEX_MIN_ARTICLES, tagPath } from "@/lib/tags";

type Props = { params: Promise<{ slug: string }> };

// En cache CDN, régénérée toutes les 10 minutes : un nouvel article y apparaît vite.
export const revalidate = 600;

export function generateStaticParams() {
  return [];
}

const MAX_ARTICLES = 60;

const KIND_LABEL: Record<TagKind, string> = {
  personne: "Personnalité",
  organisation: "Institution",
  lieu: "Lieu",
  sujet: "Thème",
};

const SCHEMA_TYPE: Record<TagKind, string> = {
  personne: "Person",
  organisation: "Organization",
  lieu: "Place",
  sujet: "Thing",
};

const findTag = cache(async function findTag(slug: string) {
  return withDbTimeout(
    prisma.tag.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        _count: {
          select: { articles: { where: { article: { status: "published" } } } },
        },
        articles: {
          where: { article: { status: "published" } },
          orderBy: { article: { publishedAt: "desc" } },
          take: MAX_ARTICLES,
          select: {
            article: {
              select: {
                id: true,
                publicId: true,
                title: true,
                excerpt: true,
                publishedAt: true,
                coverImageUrl: true,
                category: true,
              },
            },
          },
        },
      },
    }),
  );
});

/** Sujets qui reviennent le plus souvent dans les mêmes articles. */
async function relatedTags(tagId: string, articleIds: string[]) {
  if (articleIds.length === 0) return [];
  const rows = await withDbTimeout(
    prisma.articleTag.groupBy({
      by: ["tagId"],
      where: { articleId: { in: articleIds }, tagId: { not: tagId } },
      _count: { tagId: true },
      orderBy: { _count: { tagId: "desc" } },
      take: 24,
    }),
  );
  const tags = await withDbTimeout(
    prisma.tag.findMany({
      where: { id: { in: rows.map((r) => r.tagId) } },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: {
          select: { articles: { where: { article: { status: "published" } } } },
        },
      },
    }),
  );
  return rows
    .map((r) => tags.find((t) => t.id === r.tagId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .filter((t) => t._count.articles >= TAG_INDEX_MIN_ARTICLES)
    .slice(0, 10);
}

/** « hébergement d'urgence » devient « Hébergement d'urgence » en tête de titre. */
function capitalized(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function pageTitle(name: string, kind: TagKind): string {
  return kind === "personne" || kind === "organisation"
    ? `${name} : actualité et articles`
    : `${capitalized(name)} : toute l'actualité`;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = await findTag(slug);
  if (!tag) return { title: "Sujet introuvable" };
  const count = tag._count.articles;
  const latest = tag.articles[0]?.article;
  const description = truncate(
    `Toute l'actualité sur ${tag.name} dans Le Rempart : ${count} article${count > 1 ? "s" : ""}${
      latest ? `, dont « ${latest.title} »` : ""
    }.`,
    158,
  );
  return buildPageMetadata({
    title: pageTitle(tag.name, tag.kind),
    description,
    path: tagPath(tag.slug),
    image: latest?.coverImageUrl ?? undefined,
    imageAlt: tag.name,
    // Une page avec un ou deux articles reste hors de Google : trop mince.
    noIndex: count < TAG_INDEX_MIN_ARTICLES,
  });
}

export default async function SujetPage({ params }: Props) {
  const { slug } = await params;
  const tag = await findTag(slug);
  if (!tag || tag._count.articles === 0) notFound();

  const articles = tag.articles.map((a) => a.article);
  const related = await relatedTags(
    tag.id,
    articles.map((a) => a.id),
  ).catch(() => []);
  const count = tag._count.articles;
  const path = tagPath(tag.slug);

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: pageTitle(tag.name, tag.kind),
          url: absoluteUrl(path),
          inLanguage: "fr-FR",
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
          publisher: { "@id": ORGANIZATION_ID },
          about: { "@type": SCHEMA_TYPE[tag.kind], name: tag.name },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: articles.length,
            itemListElement: articles.slice(0, 20).map((a, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absoluteUrl(articlePublicPath(a.publicId)),
              name: a.title,
            })),
          },
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Sujets", path: "/sujets" },
          { name: capitalized(tag.name), path },
        ])}
      />

      <nav aria-label="Fil d'Ariane" className="mb-6 text-sm">
        <Link
          href="/sujets"
          className="font-display tracking-[0.1em] text-ink no-underline underline-offset-4 hover:text-gold hover:underline"
        >
          Tous les sujets
        </Link>
      </nav>

      <header className="mb-8">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          {KIND_LABEL[tag.kind]}
        </p>
        <h1 className="font-headline mt-2 text-4xl sm:text-5xl">{capitalized(tag.name)}</h1>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
        <p className="mt-4 max-w-2xl text-base text-muted">
          Toute l&apos;actualité sur {tag.name} dans Le Rempart : {count} article
          {count > 1 ? "s" : ""}, du plus récent au plus ancien.
        </p>
      </header>

      <div>
        {articles.map((article, index) => (
          <ArticleCard
            key={article.id}
            id={article.id}
            publicId={article.publicId}
            title={article.title}
            excerpt={article.excerpt}
            publishedAt={article.publishedAt}
            category={article.category}
            hasCover={Boolean(article.coverImageUrl)}
            coverUrl={article.coverImageUrl}
            featured={index === 0}
            index={index}
          />
        ))}
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="sujets-lies" className="mt-14 border-t border-ink/10 pt-8">
          <h2 id="sujets-lies" className="font-display text-[0.8rem] tracking-[0.16em] text-ink">
            Sujets liés
          </h2>
          <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
            {related.map((t) => (
              <li key={t.slug}>
                <Link
                  href={tagPath(t.slug)}
                  className="inline-block rounded-full border border-ink/20 px-3 py-1 text-sm text-ink no-underline transition hover:border-accent hover:text-gold hover:no-underline"
                >
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/ArticleBody";
import { CoverImg } from "@/components/CoverImg";
import { JsonLd } from "@/components/JsonLd";
import { PlusSubscribeButton } from "@/components/PlusSubscribeButton";
import { PremiumBanner } from "@/components/PremiumBanner";
import { PublishedAt } from "@/components/PublishedAt";
import { SITE_AUTHOR } from "@/lib/authors";
import { PREMIUM_CATEGORY } from "@/lib/categories";
import { hasActiveRempartPlus } from "@/lib/membership";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  breadcrumbTitle,
  buildPageMetadata,
  dossierPath,
  newsArticleJsonLd,
  SITE_LOGO_SQUARE,
  SITE_NAME,
} from "@/lib/seo";
import { teaserMarkdown } from "@/lib/teaser";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

type DossierRow = {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  membersOnly: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

async function findPublishedDossier(slug: string): Promise<DossierRow | null> {
  return withDbTimeout(
    prisma.specialDossier.findFirst({
      where: { slug, publishedAt: { not: null } },
      select: {
        title: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        membersOnly: true,
        publishedAt: true,
        updatedAt: true,
      },
    }),
  );
}

// Mêmes métadonnées qu'un article : image, auteur, dates et rubrique pour Google et les réseaux.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const d = await findPublishedDossier(slug);
    if (!d) return { title: "Enquête introuvable" };

    const url = absoluteUrl(dossierPath(slug));
    const imageUrl = d.coverImageUrl || absoluteUrl(SITE_LOGO_SQUARE);

    return {
      ...buildPageMetadata({
        title: d.title,
        description: d.excerpt,
        path: dossierPath(slug),
        ogType: "article",
        image: imageUrl,
        imageAlt: d.title,
      }),
      authors: [{ name: SITE_AUTHOR.name, url: absoluteUrl(SITE_AUTHOR.path) }],
      openGraph: {
        title: d.title,
        description: d.excerpt,
        type: "article",
        url,
        siteName: SITE_NAME,
        locale: "fr_FR",
        publishedTime: d.publishedAt?.toISOString(),
        modifiedTime: d.updatedAt?.toISOString(),
        section: PREMIUM_CATEGORY.label,
        authors: [SITE_AUTHOR.name],
        images: [{ url: imageUrl, alt: d.title }],
      },
      twitter: {
        card: "summary_large_image",
        title: d.title,
        description: d.excerpt,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: SITE_NAME };
  }
}

export default async function DossierPage({ params }: Props) {
  const { slug } = await params;
  const plus = await hasActiveRempartPlus();

  let dossier: DossierRow | null = null;
  try {
    dossier = await findPublishedDossier(slug);
  } catch {
    notFound();
  }

  if (!dossier) notFound();

  const locked = dossier.membersOnly && !plus;
  const body = locked ? teaserMarkdown(dossier.content) : dossier.content;

  return (
    <article className="animate-fade-up mx-auto max-w-3xl">
      <JsonLd
        data={newsArticleJsonLd({
          title: dossier.title,
          excerpt: dossier.excerpt,
          url: absoluteUrl(dossierPath(slug)),
          imageUrl: dossier.coverImageUrl,
          publishedAt: dossier.publishedAt,
          updatedAt: dossier.updatedAt,
          section: PREMIUM_CATEGORY.label,
          authorName: SITE_AUTHOR.name,
          accessibleForFree: !dossier.membersOnly,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Dernières news", path: "/" },
          { name: PREMIUM_CATEGORY.label, path: PREMIUM_CATEGORY.path },
          { name: dossier.title, path: dossierPath(slug) },
        ])}
      />

      <nav aria-label="Fil d'Ariane" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href="/"
              className="font-display tracking-[0.1em] text-ink no-underline underline-offset-4 hover:text-accent-deep hover:underline"
            >
              Dernières news
            </Link>
          </li>
          <li aria-hidden className="text-accent">
            /
          </li>
          <li>
            <Link
              href={PREMIUM_CATEGORY.path}
              className="font-display tracking-[0.1em] text-ink no-underline underline-offset-4 hover:text-accent-deep hover:underline"
            >
              {PREMIUM_CATEGORY.short}
            </Link>
          </li>
          <li aria-hidden className="text-accent">
            /
          </li>
          <li className="text-muted">{breadcrumbTitle(dossier.title)}</li>
        </ol>
      </nav>

      <PremiumBanner label="Enquête exclusive" subscribed={plus} />

      <header className="mb-5">
        <PublishedAt
          value={dossier.publishedAt}
          className="block text-xs uppercase tracking-[0.14em] text-muted"
        />
        <h1 className="font-display mt-3 text-[1.75rem] leading-[1.05] sm:text-3xl md:text-4xl">
          {dossier.title}
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
          Par{" "}
          <Link
            href={SITE_AUTHOR.path}
            rel="author"
            className="text-ink no-underline underline-offset-4 hover:text-accent-deep hover:underline"
          >
            {SITE_AUTHOR.name}
          </Link>
        </p>
        <div className="gold-rule animate-line-grow mt-5 max-w-md" />
        <p className="mt-5 text-lg italic text-black">{dossier.excerpt}</p>
      </header>

      {dossier.coverImageUrl ? (
        <figure className="mb-10">
          <div className="media-frame aspect-[16/9] w-full shadow-[var(--shadow-soft)]">
            <CoverImg
              url={dossier.coverImageUrl}
              alt={dossier.title}
              sizes="(min-width: 800px) 48rem, 100vw"
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </figure>
      ) : null}

      {locked ? (
        <div>
          {/* Aperçu : seul ce début est envoyé au navigateur, il s'estompe vers l'appel à s'abonner. */}
          <div className="relative max-h-[30rem] overflow-hidden">
            <ArticleBody content={body} showNewsletterCta={false} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[var(--color-paper)]" />
          </div>
          <div className="relative z-10 -mt-6 rounded-lg border border-accent/45 bg-ink px-5 py-8 text-center text-paper shadow-[0_14px_40px_rgba(0,0,0,0.28)] sm:px-10">
            <p className="font-display text-[1.05rem] tracking-[0.22em] text-accent">
              La suite est réservée aux abonnés
            </p>
            <p className="font-display mx-auto mt-3 max-w-lg text-2xl leading-tight tracking-[0.06em] sm:text-3xl">
              Lisez l&apos;enquête en entier avec le Rempart+
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/75">
              4,90&nbsp;€ par mois, sans engagement. Toutes nos enquêtes, le Brief
              approfondi chaque matin et le site sans publicité.
            </p>
            <div className="mt-6 flex justify-center">
              <PlusSubscribeButton />
            </div>
            <p className="mt-5 text-sm text-white/70">
              Déjà abonné ?{" "}
              <Link href="/connexion" className="text-accent underline decoration-accent/60">
                Connectez-vous avec votre e-mail
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <ArticleBody content={body} showNewsletterCta={false} />
      )}
    </article>
  );
}

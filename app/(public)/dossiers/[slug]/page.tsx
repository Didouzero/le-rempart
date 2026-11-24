import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleBody } from "@/components/ArticleBody";
import { Caption, captionText } from "@/components/CoverCaption";
import { CoverImg } from "@/components/CoverImg";
import { JsonLd } from "@/components/JsonLd";
import { PlusSubscribeButton } from "@/components/PlusSubscribeButton";
import { PremiumBanner } from "@/components/PremiumBanner";
import { AuthorBox, Byline, readingMinutesOf, TagChips, wasUpdated } from "@/components/ArticleMeta";
import { ShareButtons } from "@/components/ShareButtons";
import { SITE_AUTHOR } from "@/lib/authors";
import { PREMIUM_CATEGORY } from "@/lib/categories";
import { getDossierCoverAlt } from "@/lib/investigation-draft";
import { isVerifiedGooglebot } from "@/lib/googlebot";
import { hasActiveRempartPlus } from "@/lib/membership";
import { prisma, withDbTimeout } from "@/lib/prisma";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPageMetadata,
  dossierPath,
  newsArticleJsonLd,
  PAYWALL_CLASS,
  SITE_LOGO_SQUARE,
  SITE_NAME,
} from "@/lib/seo";
import { splitTeaser } from "@/lib/teaser";
import { dossierTags, tagPath, type TagWithCount } from "@/lib/tags";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

type DossierRow = {
  id: string;
  publicId: number;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  membersOnly: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

/** Numéro court (/dossiers/12) ou ancienne adresse longue tirée du titre. */
async function findPublishedDossier(param: string): Promise<DossierRow | null> {
  const where = /^\d+$/.test(param)
    ? { publicId: Number(param) }
    : { slug: param };
  return withDbTimeout(
    prisma.specialDossier.findFirst({
      where: { ...where, publishedAt: { not: null } },
      select: {
        id: true,
        publicId: true,
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

    const url = absoluteUrl(dossierPath(d.publicId));
    const imageUrl = d.coverImageUrl || absoluteUrl(SITE_LOGO_SQUARE);

    return {
      ...buildPageMetadata({
        title: d.title,
        description: d.excerpt,
        path: dossierPath(d.publicId),
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
  // Les anciennes adresses longues restent valables et renvoient vers le numéro court.
  if (!/^\d+$/.test(slug)) permanentRedirect(dossierPath(dossier.publicId));

  const coverAlt = await getDossierCoverAlt(dossier.id).catch(() => null);
  const tags: TagWithCount[] = await dossierTags(dossier.id).catch(() => []);
  const locked = dossier.membersOnly && !plus;
  // Googlebot vérifié lit la suite, balisée payante ; les visiteurs n'en reçoivent rien.
  const crawler = locked && (await isVerifiedGooglebot());
  const { teaser, rest } = locked
    ? splitTeaser(dossier.content)
    : { teaser: dossier.content, rest: "" };

  return (
    <article className="animate-fade-up mx-auto max-w-3xl">
      <JsonLd
        data={newsArticleJsonLd({
          title: dossier.title,
          excerpt: dossier.excerpt,
          url: absoluteUrl(dossierPath(dossier.publicId)),
          imageUrl: dossier.coverImageUrl,
          publishedAt: dossier.publishedAt,
          updatedAt: dossier.updatedAt,
          section: PREMIUM_CATEGORY.label,
          authorName: SITE_AUTHOR.name,
          accessibleForFree: !dossier.membersOnly,
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
          { name: PREMIUM_CATEGORY.label, path: PREMIUM_CATEGORY.path },
          { name: dossier.title, path: dossierPath(dossier.publicId) },
        ])}
      />

      <PremiumBanner label="Enquête exclusive" subscribed={plus} />

      <header className="mb-8">
        {/* Même en-tête que les articles : surtitre, titre, chapô, signature. */}
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          <Link href={PREMIUM_CATEGORY.path} className="text-inherit no-underline hover:underline">
            {PREMIUM_CATEGORY.short}
          </Link>
        </p>
        <h1 className="font-headline mt-4 text-[1.9rem] leading-[1.1] sm:text-[2.35rem] md:text-[2.75rem]">
          {dossier.title}
        </h1>
        <p className="article-standfirst mt-5">{dossier.excerpt}</p>
        <Byline
          author={SITE_AUTHOR.name}
          publishedAt={dossier.publishedAt}
          updatedAt={wasUpdated(dossier.publishedAt, dossier.updatedAt) ? dossier.updatedAt : null}
          readingMinutes={readingMinutesOf(dossier.content)}
          shareUrl={absoluteUrl(dossierPath(dossier.publicId))}
          shareTitle={dossier.title}
        />
      </header>

      {dossier.coverImageUrl ? (
        <figure className="mb-10">
          <div className="media-frame aspect-[16/9] w-full shadow-[var(--shadow-soft)]">
            <CoverImg
              url={dossier.coverImageUrl}
              alt={coverAlt ? captionText(coverAlt) : dossier.title}
              sizes="(min-width: 800px) 48rem, 100vw"
              priority
              className="h-full w-full object-cover"
            />
          </div>
          {coverAlt ? (
            <figcaption className="mt-2 text-sm italic text-muted">
              <Caption source={coverAlt} />
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {locked ? (
        <div>
          {crawler ? (
            <ArticleBody content={teaser} showNewsletterCta={false} />
          ) : (
            /* Aperçu : seul ce début est envoyé au navigateur, il s'estompe vers l'appel à s'abonner. */
            <div className="relative max-h-[30rem] overflow-hidden">
              <ArticleBody content={teaser} showNewsletterCta={false} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-paper" />
            </div>
          )}
          <div className={PAYWALL_CLASS}>
            {crawler && rest ? (
              <ArticleBody content={rest} showNewsletterCta={false} />
            ) : null}
            <div
              className={`relative z-10 ${crawler ? "mt-10" : "-mt-6"} rounded-lg border border-accent/45 bg-ink px-5 py-8 text-center text-paper shadow-[var(--shadow-soft)] sm:px-10`}
            >
              <p className="section-kicker justify-center text-accent">
                La suite est réservée aux abonnés
              </p>
              <p className="font-headline mx-auto mt-3 max-w-lg text-2xl leading-tight font-bold sm:text-3xl">
                Lisez l&apos;enquête en entier avec le Rempart+
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm text-white/75">
                4,90&nbsp;€ par mois, sans engagement. Toutes nos enquêtes et le
                Brief approfondi chaque matin.
              </p>
              <div className="mt-6 flex justify-center">
                <PlusSubscribeButton />
              </div>
              <p className="mt-5 text-sm text-white/70">
                Déjà abonné ?{" "}
                <Link
                  href="/connexion"
                  className="text-accent underline decoration-accent/60"
                >
                  Connectez-vous avec votre e-mail
                </Link>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ArticleBody content={teaser} showNewsletterCta={false} />
      )}

      <footer className="mt-12 space-y-8">
        <TagChips tags={tags} label="Sujets de l'enquête" />
        <ShareButtons url={absoluteUrl(dossierPath(dossier.publicId))} title={dossier.title} />
        <AuthorBox />
      </footer>
    </article>
  );
}

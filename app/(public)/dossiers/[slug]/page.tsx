import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/ArticleBody";
import { PublishedAt } from "@/components/PublishedAt";
import { hasActiveRempartPlus } from "@/lib/membership";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const d = await prisma.specialDossier.findUnique({
      where: { slug },
      select: { title: true, excerpt: true },
    });
    if (!d) return { title: "Dossier" };
    return buildPageMetadata({
      title: d.title,
      description: d.excerpt,
      path: `/dossiers/${slug}`,
    });
  } catch {
    return { title: "Dossier" };
  }
}

export default async function DossierPage({ params }: Props) {
  const { slug } = await params;
  const plus = await hasActiveRempartPlus();

  let dossier: {
    title: string;
    excerpt: string;
    content: string;
    coverImageUrl: string | null;
    membersOnly: boolean;
    publishedAt: Date | null;
  } | null = null;

  try {
    dossier = await withDbTimeout(
      prisma.specialDossier.findFirst({
        where: { slug, publishedAt: { not: null } },
        select: {
          title: true,
          excerpt: true,
          content: true,
          coverImageUrl: true,
          membersOnly: true,
          publishedAt: true,
        },
      }),
    );
  } catch {
    notFound();
  }

  if (!dossier) notFound();

  if (dossier.membersOnly && !plus) {
    return (
      <article className="animate-fade-up max-w-2xl">
        <p className="section-kicker">Rempart+</p>
        <h1 className="font-display mt-2 text-3xl tracking-[0.08em]">
          {dossier.title}
        </h1>
        <p className="mt-4 text-muted">{dossier.excerpt}</p>
        <p className="mt-8 text-ink">
          Ce dossier est réservé aux abonnés Rempart+.
        </p>
        <p className="mt-4">
          <Link
            href="/s-abonner"
            className="font-display tracking-[0.12em] underline decoration-accent"
          >
            S&apos;abonner — 4,90&nbsp;€ / mois
          </Link>
        </p>
      </article>
    );
  }

  return (
    <article className="animate-fade-up mx-auto max-w-3xl">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Enquête &amp; révélations
      </p>
      <PublishedAt
        value={dossier.publishedAt}
        weekday
        className="mt-3 block text-xs uppercase tracking-[0.14em] text-muted"
      />
      <h1 className="font-display mt-3 text-[1.85rem] leading-[1.08] sm:text-4xl md:text-[2.6rem]">
        {dossier.title}
      </h1>
      <p className="mt-5 max-w-2xl border-l-4 border-accent pl-4 text-lg italic text-ink">
        {dossier.excerpt}
      </p>
      {dossier.coverImageUrl ? (
        <div className="media-frame my-10 max-h-[36rem] w-full shadow-[var(--shadow-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dossier.coverImageUrl}
            alt=""
            className="max-h-[36rem] w-full object-cover"
          />
        </div>
      ) : (
        <div className="gold-rule animate-line-grow mt-8 max-w-md" />
      )}
      <ArticleBody content={dossier.content} showNewsletterCta={false} />
    </article>
  );
}

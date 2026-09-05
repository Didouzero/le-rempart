import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/ArticleBody";
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
    <article className="animate-fade-up max-w-3xl">
      <p className="section-kicker">Dossier</p>
      <h1 className="font-display mt-2 text-3xl tracking-[0.08em] sm:text-4xl">
        {dossier.title}
      </h1>
      <p className="mt-4 text-lg italic text-ink">{dossier.excerpt}</p>
      {dossier.coverImageUrl ? (
        <div className="media-frame my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dossier.coverImageUrl} alt="" />
        </div>
      ) : null}
      <ArticleBody content={dossier.content} showNewsletterCta={false} />
    </article>
  );
}

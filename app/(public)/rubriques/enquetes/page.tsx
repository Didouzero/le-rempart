import type { Metadata } from "next";
import Link from "next/link";
import { CrownCircleIcon, CrownIcon } from "@/components/BrandIcons";
import { JsonLd } from "@/components/JsonLd";
import { NativeAdsRail } from "@/components/NativeAdsRail";
import { PREMIUM_CATEGORY } from "@/lib/categories";
import { hasActiveRempartPlus } from "@/lib/membership";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { buildPageMetadata, collectionPageJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: PREMIUM_CATEGORY.label,
  description: PREMIUM_CATEGORY.description,
  path: PREMIUM_CATEGORY.path,
});

const PLACEHOLDERS = [
  {
    slug: "mercredi",
    title: "Enquête du mercredi",
    excerpt:
      "Révélation documentée — première livraison mercredi. Réservée aux abonnés Rempart+.",
    publishedAt: null as Date | null,
    coverImageUrl: null as string | null,
  },
  {
    slug: "samedi",
    title: "Enquête du samedi",
    excerpt:
      "Dossier exclusif — prochaine livraison samedi. Réservée aux abonnés Rempart+.",
    publishedAt: null as Date | null,
    coverImageUrl: null as string | null,
  },
];

function formatDate(value: Date | null): string {
  if (!value) return "Bientôt";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}

export default async function EnquetesPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const params = await searchParams;
  const isPlus = await hasActiveRempartPlus();
  let dossiers: Array<{
    slug: string;
    title: string;
    excerpt: string;
    publishedAt: Date | null;
    coverImageUrl: string | null;
  }> = [];

  try {
    dossiers = await withDbTimeout(
      prisma.specialDossier.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        select: {
          slug: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          coverImageUrl: true,
        },
        take: isPlus ? 50 : 2,
      }),
    );
  } catch {
    dossiers = [];
  }

  const lockedCards =
    dossiers.length >= 2
      ? dossiers.slice(0, 2)
      : [...dossiers, ...PLACEHOLDERS.slice(dossiers.length)];

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={collectionPageJsonLd({
          name: PREMIUM_CATEGORY.label,
          description: PREMIUM_CATEGORY.description,
          path: PREMIUM_CATEGORY.path,
        })}
      />
      <div className="mb-8">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Rempart+
        </p>
        <h1 className="font-display mt-2 flex flex-wrap items-center gap-3 text-4xl tracking-[0.08em] sm:text-5xl">
          {PREMIUM_CATEGORY.label}
          <CrownIcon className="h-8 w-8 text-accent sm:h-9 sm:w-9" />
        </h1>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
        <p className="mt-4 max-w-2xl text-base text-muted">
          {PREMIUM_CATEGORY.description}
        </p>
      </div>

      {params.welcome === "1" && isPlus ? (
        <p className="mb-8 rounded-lg border border-accent/40 bg-accent/15 px-4 py-3 text-ink">
          Bienvenue. Votre accès Rempart+ est ouvert sur cet appareil. Pour y
          revenir plus tard :{" "}
          <Link href="/connexion" className="underline decoration-accent">
            connexion par e-mail
          </Link>
          .
        </p>
      ) : null}

      {isPlus ? (
        dossiers.length === 0 ? (
          <p className="py-16 text-center text-muted">
            Les premières enquêtes arrivent mercredi et samedi. Votre accès
            Rempart+ est déjà ouvert.
          </p>
        ) : (
          <ul className="mt-4 list-none space-y-8 p-0">
            {dossiers.map((d) => (
              <li key={d.slug} className="border-b border-ink/10 pb-8">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">
                  {formatDate(d.publishedAt)}
                </p>
                <h2 className="font-display mt-2 text-2xl tracking-[0.06em]">
                  <Link
                    href={`/dossiers/${d.slug}`}
                    className="no-underline hover:text-accent-deep"
                  >
                    {d.title}
                  </Link>
                </h2>
                <p className="mt-2 text-muted">{d.excerpt}</p>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="relative overflow-hidden">
          <div className="pointer-events-none select-none space-y-5">
            {lockedCards.map((d, i) => (
              <article
                key={d.slug}
                className="rounded-lg border border-ink/10 bg-white/55 p-5 shadow-[var(--shadow-soft)]"
                style={{
                  opacity: i === 0 ? 0.72 : 0.28,
                  filter: i === 0 ? "none" : "blur(0.4px)",
                }}
                aria-hidden={i > 0}
              >
                <p className="font-display text-xs tracking-[0.16em] text-accent-deep">
                  {formatDate(d.publishedAt)} · exclusif
                </p>
                <h2 className="font-display mt-2 text-2xl tracking-[0.06em]">
                  {d.title}
                </h2>
                <p className="mt-2 text-muted">{d.excerpt}</p>
              </article>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--color-paper)_35%,transparent)] to-[var(--color-paper)]" />
          <div className="relative z-10 -mt-28 flex flex-col items-center px-4 pb-4 text-center sm:-mt-32">
            <p className="font-display max-w-lg text-2xl tracking-[0.08em] text-ink sm:text-3xl">
              Abonnez-vous au Rempart+ pour découvrir l&apos;envers du décor
            </p>
            <Link
              href="/s-abonner"
              className="group mt-6 inline-flex items-center gap-3 rounded-lg border border-accent/50 bg-accent px-5 py-3 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-deep hover:no-underline hover:shadow-[0_12px_28px_rgba(255,189,89,0.45)]"
            >
              <CrownCircleIcon className="h-8 w-8" />
              <span className="flex flex-col leading-none text-left">
                <span className="font-display text-[1.05rem] tracking-[0.14em]">
                  S&apos;abonner
                </span>
                <span className="font-display mt-0.5 text-[1.05rem] tracking-[0.14em]">
                  au Rempart+
                </span>
              </span>
            </Link>
          </div>
        </div>
      )}

      {isPlus ? null : <NativeAdsRail />}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CrownCircleIcon } from "@/components/BrandIcons";
import { DossierCard, type DossierTeaser } from "@/components/DossierCard";
import { JsonLd } from "@/components/JsonLd";
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

const PLACEHOLDERS: DossierTeaser[] = [
  {
    slug: "mercredi",
    title: "Enquête du mercredi",
    excerpt:
      "Révélation documentée — première livraison mercredi. Réservée aux abonnés Rempart+.",
    publishedAt: null,
    coverImageUrl: null,
  },
  {
    slug: "samedi",
    title: "Enquête du samedi",
    excerpt:
      "Dossier exclusif — prochaine livraison samedi. Réservée aux abonnés Rempart+.",
    publishedAt: null,
    coverImageUrl: null,
  },
];

export default async function EnquetesPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const params = await searchParams;
  const isPlus = await hasActiveRempartPlus();
  let dossiers: DossierTeaser[] = [];

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
  const [featured, ...rest] = dossiers;

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
        <h1 className="font-display mt-2 text-4xl tracking-[0.08em] sm:text-5xl">
          {PREMIUM_CATEGORY.label}
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
          <div className="mt-4 space-y-12">
            {featured ? <DossierCard dossier={featured} featured /> : null}
            {rest.length > 0 ? (
              <ul className="grid list-none gap-8 p-0 sm:grid-cols-2">
                {rest.map((d, i) => (
                  <li key={d.slug}>
                    <DossierCard dossier={d} index={i + 1} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : (
        <div>
          <div className="relative overflow-hidden">
            <div className="space-y-10">
              {lockedCards[0] ? (
                <DossierCard dossier={lockedCards[0]} featured locked />
              ) : null}
              {lockedCards[1] ? (
                <div
                  className="pointer-events-none select-none"
                  style={{ opacity: 0.38, filter: "blur(0.6px)" }}
                  aria-hidden
                >
                  <DossierCard dossier={lockedCards[1]} locked index={1} />
                </div>
              ) : null}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--color-paper)]" />
          </div>
          <div className="relative z-10 -mt-8 flex flex-col items-center px-4 pb-4 text-center">
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
    </div>
  );
}

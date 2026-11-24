import type { Metadata } from "next";
import Link from "next/link";
import { DossierCard, type DossierTeaser } from "@/components/DossierCard";
import { JsonLd } from "@/components/JsonLd";
import { PlusSubscribeButton } from "@/components/PlusSubscribeButton";
import { PremiumBanner } from "@/components/PremiumBanner";
import { PREMIUM_CATEGORY } from "@/lib/categories";
import { hasActiveRempartPlus } from "@/lib/membership";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { absoluteUrl, buildPageMetadata, collectionPageJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: PREMIUM_CATEGORY.seoTitle,
  description: PREMIUM_CATEGORY.description,
  path: PREMIUM_CATEGORY.path,
  image: absoluteUrl("/rubriques/enquetes.jpg"),
  imageAlt: "Rubrique Enquêtes — Le Rempart",
  imageSize: { width: 1200, height: 630 },
});

const PLACEHOLDERS: DossierTeaser[] = [
  {
    publicId: 0,
    title: "Enquête du mercredi",
    excerpt:
      "Révélation documentée — première livraison mercredi. Réservée aux abonnés Rempart+.",
    publishedAt: null,
    coverImageUrl: null,
  },
  {
    publicId: 0,
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
          publicId: true,
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
        <PremiumBanner label="Enquêtes & révélations" subscribed={isPlus} />
        <h1 className="font-headline mt-2 text-4xl sm:text-5xl">
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
                  <li key={d.publicId}>
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-paper" />
          </div>
          <div className="relative z-10 -mt-8 flex flex-col items-center px-4 pb-4 text-center">
            <p className="font-display max-w-lg text-2xl tracking-[0.08em] text-ink sm:text-3xl">
              Abonnez-vous au Rempart+ pour découvrir l&apos;envers du décor
            </p>
            <div className="mt-6">
              <PlusSubscribeButton />
            </div>
          </div>
        </div>
      )}

      <section
        aria-labelledby="enquetes-presentation"
        className="mt-16 max-w-3xl border-t border-ink/10 pt-8 text-sm leading-relaxed text-muted"
      >
        <h2
          id="enquetes-presentation"
          className="font-display text-[0.8rem] tracking-[0.16em] text-ink"
        >
          Les enquêtes du Rempart
        </h2>
        <p className="mt-3">
          Deux fois par semaine, le mercredi et le samedi, Le Rempart publie une
          enquête exclusive : un dossier construit à partir de documents
          publics, rapports officiels, budgets, délibérations et décisions de
          justice, qui suit l&apos;argent et les responsabilités jusqu&apos;au
          bout.
        </p>
        <p className="mt-3">
          Subventions versées à des associations, dépenses des collectivités,
          fraudes, coût réel de l&apos;immigration, patrimoine et votes des
          élus : chaque enquête nomme les décideurs, cite ses sources et
          renvoie aux documents d&apos;origine pour que chacun puisse vérifier.
        </p>
        <p className="mt-3">
          Les enquêtes sont réservées aux abonnés{" "}
          <Link href="/s-abonner" className="underline decoration-accent">
            Rempart+
          </Link>
          , qui reçoivent aussi chaque matin le brief de l&apos;actualité. Les
          articles d&apos;actualité du site restent en accès libre. Notre
          méthode est détaillée dans la{" "}
          <Link href="/charte-editoriale" className="underline decoration-accent">
            charte éditoriale
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { prisma, withDbTimeout } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";
import { hasActiveRempartPlus } from "@/lib/membership";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Dossiers Rempart+",
  description:
    "Enquêtes et analyses approfondies réservées aux abonnés Rempart+.",
  path: "/dossiers",
});

type Props = {
  searchParams: Promise<{ welcome?: string }>;
};

export default async function DossiersPage({ searchParams }: Props) {
  const params = await searchParams;
  const isPlus = await hasActiveRempartPlus();
  let dossiers: Array<{
    slug: string;
    title: string;
    excerpt: string;
    publishedAt: Date | null;
    membersOnly: boolean;
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
          membersOnly: true,
        },
        take: 50,
      }),
    );
  } catch {
    dossiers = [];
  }

  return (
    <div className="animate-fade-up max-w-3xl">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Rempart+
      </p>
      <h1 className="font-display mt-2 text-4xl tracking-[0.08em]">
        Dossiers &amp; analyses
      </h1>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      <p className="mt-4 text-muted">
        Enquêtes et dossiers spéciaux. Les contenus membres-only sont réservés
        aux abonnés{" "}
        <Link href="/s-abonner" className="underline decoration-accent">
          Rempart+
        </Link>
        .
      </p>
      {params.welcome === "1" && isPlus ? (
        <p className="mt-6 border border-accent/40 bg-accent/15 px-4 py-3 text-ink">
          Bienvenue. Votre accès Rempart+ est ouvert sur cet appareil. Pour y
          revenir plus tard :{" "}
          <Link href="/connexion" className="underline decoration-accent">
            connexion par e-mail
          </Link>
          .
        </p>
      ) : null}

      {dossiers.length === 0 ? (
        <p className="mt-12 text-muted">
          Les premiers dossiers arrivent bientôt. En attendant, abonnez-vous pour
          être prévenu dès leur publication.
        </p>
      ) : (
        <ul className="mt-10 list-none space-y-8 p-0">
          {dossiers.map((d) => {
            const locked = d.membersOnly && !isPlus;
            return (
              <li key={d.slug} className="border-b border-ink/10 pb-8">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">
                  {d.membersOnly ? "Abonnés Rempart+" : "Libre"}
                </p>
                <h2 className="font-display mt-2 text-2xl tracking-[0.06em]">
                  {locked ? (
                    d.title
                  ) : (
                    <Link
                      href={`/dossiers/${d.slug}`}
                      className="no-underline hover:text-accent-deep"
                    >
                      {d.title}
                    </Link>
                  )}
                </h2>
                <p className="mt-2 text-muted">{d.excerpt}</p>
                {locked ? (
                  <p className="mt-3 text-sm">
                    <Link
                      href="/s-abonner"
                      className="font-display tracking-[0.1em] text-ink underline decoration-accent"
                    >
                      Débloquer avec Rempart+
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

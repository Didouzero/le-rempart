import type { Metadata } from "next";
import Link from "next/link";
import { TAG_CHIP } from "@/components/ArticleMeta";
import type { TagKind } from "@prisma/client";
import { JsonLd } from "@/components/JsonLd";
import { buildPageMetadata, collectionPageJsonLd } from "@/lib/seo";
import { indexableTags, tagPath, type TagWithCount } from "@/lib/tags";

export const revalidate = 3600;

const DESCRIPTION =
  "Les personnalités, institutions, lieux et thèmes que suit Le Rempart : chaque sujet rassemble tous nos articles, du plus récent au plus ancien.";

export const metadata: Metadata = buildPageMetadata({
  title: "Tous les sujets",
  description: DESCRIPTION,
  path: "/sujets",
});

const GROUPS: Array<{ kind: TagKind; title: string }> = [
  { kind: "personne", title: "Personnalités" },
  { kind: "organisation", title: "Institutions et partis" },
  { kind: "sujet", title: "Thèmes" },
  { kind: "lieu", title: "Lieux" },
];

export default async function SujetsPage() {
  let tags: TagWithCount[] = [];
  try {
    tags = await indexableTags(600);
  } catch {
    tags = [];
  }

  return (
    <div className="animate-fade-up">
      <JsonLd
        data={collectionPageJsonLd({
          name: "Tous les sujets",
          description: DESCRIPTION,
          path: "/sujets",
        })}
      />
      <header className="mb-10">
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Sujets
        </p>
        <h1 className="font-headline mt-2 text-4xl sm:text-5xl">Tous les sujets</h1>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
        <p className="mt-4 max-w-2xl text-base text-muted">{DESCRIPTION}</p>
      </header>

      <div className="space-y-12">
        {GROUPS.map(({ kind, title }) => {
          const list = tags.filter((t) => t.kind === kind);
          if (list.length === 0) return null;
          return (
            <section key={kind} aria-labelledby={`sujets-${kind}`}>
              <h2 id={`sujets-${kind}`} className="font-headline text-3xl">
                {title}
                <span className="text-accent">.</span>
              </h2>
              <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
                {list.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={tagPath(t.slug)}
                      className={TAG_CHIP}
                    >
                      {t.name}
                      <span className="text-xs text-muted">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

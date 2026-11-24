import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ArrowRightIcon";
import { publishedArticleWhere } from "@/lib/article-list";
import { articlePublicPath } from "@/lib/article-url";
import { ARTICLE_CATEGORIES, CATEGORY_META, PREMIUM_CATEGORY } from "@/lib/categories";
import { prisma, withDbTimeout } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: true },
};

/** 404 : on garde le lecteur, avec une recherche, les rubriques et les derniers articles. */
export default async function NotFound() {
  let latest: Array<{ publicId: number; title: string }> = [];
  try {
    latest = await withDbTimeout(
      prisma.article.findMany({
        where: publishedArticleWhere({}),
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 4,
        select: { publicId: true, title: true },
      }),
    );
  } catch {
    latest = [];
  }

  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-16">
      <div className="text-center">
        <p className="font-headline text-[5.5rem] leading-none text-accent sm:text-[7rem]" aria-hidden>
          404
        </p>
        <h1 className="font-headline mt-4 text-3xl leading-tight sm:text-4xl">
          Cette page est introuvable
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          L&apos;adresse est erronée, ou l&apos;article n&apos;est plus publié. Cherchez-le, ou
          reprenez la lecture ci-dessous.
        </p>

        <form
          action="/"
          method="get"
          role="search"
          className="mx-auto mt-8 flex max-w-lg items-center gap-2"
        >
          <label htmlFor="notfound-search" className="sr-only">
            Rechercher un article
          </label>
          <input
            id="notfound-search"
            name="q"
            type="search"
            placeholder="Rechercher un article, un nom, une ville…"
            className="min-w-0 flex-1 rounded-lg border border-rule bg-transparent px-3 py-2.5 text-[1rem] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Lancer la recherche"
            title="Rechercher"
            className="group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/60 bg-ink text-accent transition duration-300 hover:border-accent hover:text-gold"
          >
            <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </form>

        <ul className="mt-6 flex list-none flex-wrap justify-center gap-2 p-0">
          {ARTICLE_CATEGORIES.map((key) => (
            <li key={key}>
              <Link
                href={`/rubriques/${CATEGORY_META[key].slug}`}
                className="font-display inline-block rounded-lg border border-rule px-3.5 py-1.5 text-[0.85rem] tracking-[0.1em] text-ink no-underline transition hover:border-accent hover:text-gold hover:no-underline"
              >
                {CATEGORY_META[key].label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={PREMIUM_CATEGORY.path}
              className="font-display inline-block rounded-lg border border-accent/60 px-3.5 py-1.5 text-[0.85rem] tracking-[0.1em] text-gold no-underline transition hover:border-accent hover:no-underline"
            >
              {PREMIUM_CATEGORY.short}
            </Link>
          </li>
        </ul>
      </div>

      {latest.length ? (
        <section aria-labelledby="derniers-articles" className="mt-14">
          <h2
            id="derniers-articles"
            className="font-display flex items-center gap-2.5 border-t-[3px] border-ink pt-3 text-[1.3rem] tracking-[0.08em]"
          >
            <span aria-hidden className="inline-block h-[0.7em] w-[0.7em] rounded-[2px] bg-accent" />
            Les derniers articles
          </h2>
          <ul className="mt-3 list-none divide-y divide-rule p-0">
            {latest.map((a) => (
              <li key={a.publicId} className="py-3">
                <Link
                  href={articlePublicPath(a.publicId)}
                  className="font-headline text-[1.1rem] leading-[1.3] text-ink no-underline hover:text-gold hover:no-underline"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/" className="read-link mt-5">
            Revenir à la une →
          </Link>
        </section>
      ) : (
        <p className="mt-10 text-center">
          <Link href="/" className="read-link">
            Revenir à la une →
          </Link>
        </p>
      )}
    </div>
  );
}

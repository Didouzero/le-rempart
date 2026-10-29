import type { Metadata } from "next";
import { HomeFeed } from "@/components/HomeFeed";
import { parsePageParam, parseSearchQuery } from "@/lib/article-list";
import {
  SITE_DEFAULT_TITLE,
  SITE_DESCRIPTION,
  buildPageMetadata,
} from "@/lib/seo";

/**
 * Accueil paginé et recherche : le middleware y réécrit « /?page=… » et « /?q=… »,
 * l'adresse visible reste « / ». La page 1 sans recherche est servie en cache par (public)/page.tsx.
 */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const q = parseSearchQuery(params.q);
  const isPaged = page > 1;
  const hasSearch = Boolean(q);

  if (!isPaged && !hasSearch) {
    return buildPageMetadata({
      title: SITE_DEFAULT_TITLE,
      description: SITE_DESCRIPTION,
      path: "/",
      absoluteTitle: true,
    });
  }

  const titleParts = [
    hasSearch ? `Recherche « ${q} »` : null,
    isPaged ? `page ${page}` : null,
  ].filter(Boolean);
  const title = titleParts.length
    ? `L'actualité à la une — ${titleParts.join(" — ")}`
    : "L'actualité à la une";

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page > 1) qs.set("page", String(page));
  const path = qs.toString() ? `/?${qs}` : "/";

  return buildPageMetadata({
    title,
    description: hasSearch
      ? `Résultats pour « ${q} » sur Le Rempart.`
      : `${SITE_DESCRIPTION} Page ${page}.`,
    path,
  });
}

export default async function HomeListPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <HomeFeed
      requested={parsePageParam(params.page)}
      q={parseSearchQuery(params.q)}
    />
  );
}

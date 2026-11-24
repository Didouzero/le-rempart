import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RubriqueView, rubriqueMetadata } from "@/components/RubriqueView";
import { parsePageParam, parseSearchQuery } from "@/lib/article-list";
import { isArticleCategory } from "@/lib/categories";

/**
 * Pages 2 et suivantes et recherche d'une rubrique. Le middleware y réécrit
 * « /rubriques/[slug]?page=… » et « ?q=… » ; l'adresse visible ne change pas.
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isArticleCategory(slug)) return { title: "Rubrique" };
  const sp = await searchParams;
  return rubriqueMetadata(slug, parsePageParam(sp.page), parseSearchQuery(sp.q));
}

export default async function RubriqueListPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!isArticleCategory(slug)) notFound();
  const sp = await searchParams;
  return (
    <RubriqueView
      category={slug}
      requested={parsePageParam(sp.page)}
      q={parseSearchQuery(sp.q)}
    />
  );
}

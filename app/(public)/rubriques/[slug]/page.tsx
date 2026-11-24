import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RubriqueView, rubriqueMetadata } from "@/components/RubriqueView";
import { ARTICLE_CATEGORIES, isArticleCategory } from "@/lib/categories";

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * Première page de la rubrique, en cache CDN (régénérée toutes les minutes).
 * Pagination et recherche : le middleware réécrit vers /rubriques-liste/[slug].
 */
export const revalidate = 60;

export function generateStaticParams() {
  return ARTICLE_CATEGORIES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isArticleCategory(slug)) return { title: "Rubrique" };
  return rubriqueMetadata(slug, 1, "");
}

export default async function RubriquePage({ params }: Props) {
  const { slug } = await params;
  if (!isArticleCategory(slug)) notFound();
  return <RubriqueView category={slug} requested={1} q="" />;
}

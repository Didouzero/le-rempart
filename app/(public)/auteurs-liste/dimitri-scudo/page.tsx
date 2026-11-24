import type { Metadata } from "next";
import { AuthorProfile, authorMetadata } from "@/components/AuthorProfile";
import { parsePageParam } from "@/lib/article-list";

/** Pages 2 et suivantes de « Ses articles » : le middleware y réécrit /auteurs/dimitri-scudo?page=… */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return authorMetadata(parsePageParam((await searchParams).page));
}

export default async function AuthorArticlesPage({ searchParams }: Props) {
  return <AuthorProfile requested={parsePageParam((await searchParams).page)} />;
}

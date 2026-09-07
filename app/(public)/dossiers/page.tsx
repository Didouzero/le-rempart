import { redirect } from "next/navigation";
import { PREMIUM_CATEGORY } from "@/lib/categories";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ welcome?: string }>;
};

/** Ancienne liste /dossiers → rubrique Enquête & révélations. */
export default async function DossiersRedirectPage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = params.welcome === "1" ? "?welcome=1" : "";
  redirect(`${PREMIUM_CATEGORY.path}${qs}`);
}

import type { Metadata } from "next";
import { AuthorProfile, authorMetadata } from "@/components/AuthorProfile";

// En cache CDN, régénérée toutes les 5 minutes. Les pages suivantes passent par
// /auteurs-liste (réécriture du middleware), comme les rubriques.
export const revalidate = 300;

export const metadata: Metadata = authorMetadata(1);

export default function AuthorPage() {
  return <AuthorProfile requested={1} />;
}

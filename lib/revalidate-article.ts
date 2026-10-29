import { revalidatePath } from "next/cache";
import { articlePublicPath } from "@/lib/article-url";

/** Rafraîchit le cache CDN de l'article et de l'accueil après publication ou correction. */
export function revalidateArticle(publicId: number | null | undefined) {
  try {
    if (publicId) revalidatePath(articlePublicPath(publicId));
    revalidatePath("/");
  } catch (err) {
    console.warn("revalidateArticle", err);
  }
}

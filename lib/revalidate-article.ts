import { revalidatePath } from "next/cache";
import { articlePublicPath } from "@/lib/article-url";
import { ARTICLE_CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { notifyIndexNow } from "@/lib/indexnow";

/** Rafraîchit le cache CDN de l'article, de l'accueil et des rubriques après publication ou correction. */
export function revalidateArticle(publicId: number | null | undefined) {
  try {
    if (publicId) revalidatePath(articlePublicPath(publicId));
    revalidatePath("/");
    // Premières pages des rubriques, en cache elles aussi.
    for (const key of ARTICLE_CATEGORIES) {
      revalidatePath(`/rubriques/${CATEGORY_META[key].slug}`);
    }
    if (publicId) notifyIndexNow([articlePublicPath(publicId)]);
  } catch (err) {
    console.warn("revalidateArticle", err);
  }
}

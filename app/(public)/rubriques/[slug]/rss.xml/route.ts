import { isArticleCategory } from "@/lib/categories";
import { rssResponse } from "@/lib/rss";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/** Flux RSS d'une rubrique. */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  if (!isArticleCategory(slug)) {
    return new Response("Not found", { status: 404 });
  }
  return rssResponse(slug);
}

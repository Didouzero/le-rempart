import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/ArticleEditor";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminEditArticlePage({ params }: Props) {
  const { id } = await params;
  // Pas de Bytes (cover/illustration) ni researchDossier : OOM Edge/serverless.
  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      publicId: true,
      title: true,
      excerpt: true,
      content: true,
      sourceText: true,
      sourceUrl: true,
      coverImageUrl: true,
      category: true,
      status: true,
    },
  });
  if (!article) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl">Éditer l&apos;article</h1>
        <p className="mt-2 text-sm text-muted">
          Lien public : /articles/{article.publicId}
        </p>
      </div>
      <ArticleEditor
        mode="edit"
        articleId={article.id}
        initial={{
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          sourceText: article.sourceText ?? "",
          sourceUrl: article.sourceUrl ?? "",
          coverImageUrl: article.coverImageUrl ?? "",
          category: article.category,
          status: article.status,
        }}
      />
    </div>
  );
}

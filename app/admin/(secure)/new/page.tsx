import { ArticleEditor } from "@/components/ArticleEditor";

export default function AdminNewArticlePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl">Nouvel article</h1>
        <p className="mt-2 text-sm text-muted">
          Saisissez une source, générez avec Kimi, puis relisez avant publication.
        </p>
      </div>
      <ArticleEditor mode="create" />
    </div>
  );
}

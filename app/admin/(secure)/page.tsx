import Link from "next/link";
import { prisma, withDbTimeout } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AdminDashboardPage() {
  let articles: Awaited<ReturnType<typeof prisma.article.findMany>> = [];

  try {
    articles = await withDbTimeout(
      prisma.article.findMany({
        orderBy: { updatedAt: "desc" },
      }),
    );
  } catch {
    return (
      <div>
        <h1 className="font-display text-3xl">Articles</h1>
        <p className="mt-4 border border-rule bg-white px-4 py-8 text-muted">
          Base de données inaccessible. Vérifiez <code>DATABASE_URL</code> et
          lancez <code>npx prisma migrate deploy</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Articles</h1>
          <p className="mt-2 text-sm text-muted">Brouillons et publications.</p>
        </div>
        <Link href="/admin/new" className="admin-btn no-underline hover:no-underline">
          Nouvel article
        </Link>
      </div>

      {articles.length === 0 ? (
        <p className="border border-rule bg-white px-4 py-10 text-center text-muted">
          Aucun article.{" "}
          <Link href="/admin/new" className="font-semibold">
            Créer le premier
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto border border-rule bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-rule bg-rule/40">
              <tr>
                <th className="px-4 py-3 font-semibold">Titre</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Mis à jour</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/articles/${article.id}`} className="font-semibold">
                      {article.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">{article.status}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(article.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/admin/articles/${article.id}`}>Éditer</Link>
                      {article.status === "published" ? (
                        <Link href={`/articles/${article.slug}`} target="_blank">
                          Voir
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

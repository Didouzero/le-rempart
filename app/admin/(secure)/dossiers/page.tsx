import Link from "next/link";
import { prisma, withDbTimeout } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "non publié";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AdminDossiersPage() {
  let dossiers: Awaited<ReturnType<typeof prisma.specialDossier.findMany>> = [];

  try {
    dossiers = await withDbTimeout(
      prisma.specialDossier.findMany({
        orderBy: { updatedAt: "desc" },
      }),
    );
  } catch {
    return (
      <div>
        <h1 className="font-display text-3xl">Enquêtes</h1>
        <p className="mt-4 text-muted">Base de données inaccessible.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Enquêtes</h1>
      <p className="mt-2 text-sm text-muted">
        Modifie le texte ici. Les lecteurs voient la version publiée sur le
        site.
      </p>

      {dossiers.length === 0 ? (
        <p className="mt-8 rounded-lg border border-rule bg-white px-4 py-10 text-center text-muted">
          Aucune enquête. Lance-en une depuis Telegram avec /enquete.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-rule bg-white">
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
              {dossiers.map((d) => (
                <tr key={d.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/dossiers/${d.id}`}
                      className="font-semibold"
                    >
                      {d.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {d.publishedAt ? "publié" : "brouillon"}
                    {d.membersOnly ? " · Rempart+" : ""}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(d.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/admin/dossiers/${d.id}`}>Éditer</Link>
                      {d.publishedAt ? (
                        <Link href={`/dossiers/${d.slug}`}>Voir</Link>
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

import { prisma, withDbTimeout } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminAbonnesPage() {
  let newsletter: Awaited<
    ReturnType<typeof prisma.newsletterSubscriber.findMany>
  > = [];
  let memberships: Awaited<ReturnType<typeof prisma.membership.findMany>> = [];

  try {
    [newsletter, memberships] = await Promise.all([
      withDbTimeout(
        prisma.newsletterSubscriber.findMany({
          where: { unsubscribedAt: null },
          orderBy: { createdAt: "desc" },
          take: 2000,
        }),
      ),
      withDbTimeout(
        prisma.membership.findMany({
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
      ),
    ]);
  } catch {
    return (
      <div>
        <h1 className="font-display text-3xl">Abonnés</h1>
        <p className="mt-4 text-muted">Base inaccessible.</p>
      </div>
    );
  }

  const plusActive = memberships.filter(
    (m) =>
      (m.status === "active" || m.status === "past_due") &&
      (!m.currentPeriodEnd || m.currentPeriodEnd.getTime() > Date.now()),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Abonnés</h1>
        <p className="mt-2 text-sm text-muted">
          Brief du matin (gratuit) et Rempart+ (payant).
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-rule bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Newsletter gratuite
          </p>
          <p className="font-display mt-2 text-4xl">{newsletter.length}</p>
          <p className="mt-1 text-sm text-muted">mails actifs (non désabonnés)</p>
        </div>
        <div className="rounded-lg border border-rule bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Rempart+ actifs
          </p>
          <p className="font-display mt-2 text-4xl">{plusActive.length}</p>
          <p className="mt-1 text-sm text-muted">
            {memberships.length} fiches au total (tous statuts)
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Brief du matin</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-rule bg-white">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-rule bg-rule/40">
              <tr>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Depuis</th>
              </tr>
            </thead>
            <tbody>
              {newsletter.map((row) => (
                <tr key={row.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-2">{row.email}</td>
                  <td className="px-4 py-2 text-muted">{row.source}</td>
                  <td className="px-4 py-2 text-muted">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Rempart+</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-rule bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-rule bg-rule/40">
              <tr>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Fin de période</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((row) => (
                <tr key={row.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-2">{row.email}</td>
                  <td className="px-4 py-2 capitalize text-muted">{row.status}</td>
                  <td className="px-4 py-2 text-muted">
                    {formatDate(row.currentPeriodEnd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { DossierEditor } from "@/components/DossierEditor";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AdminEditDossierPage({ params }: Props) {
  const { id } = await params;
  const dossier = await prisma.specialDossier.findUnique({ where: { id } });
  if (!dossier) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl">Éditer l&apos;enquête</h1>
        <p className="mt-2 text-sm text-muted">
          Corrige, allonge, recoupe. Enregistre pour mettre à jour la page
          publique.
        </p>
      </div>
      <DossierEditor
        dossierId={dossier.id}
        initial={{
          title: dossier.title,
          excerpt: dossier.excerpt,
          content: dossier.content,
          coverImageUrl: dossier.coverImageUrl ?? "",
          membersOnly: dossier.membersOnly,
          published: Boolean(dossier.publishedAt),
          slug: dossier.slug,
        }}
      />
    </div>
  );
}

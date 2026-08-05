import type { ResearchDossier } from "@/lib/research/types";

/**
 * Version compacte pour Prisma JSONB :
 * conserve la connaissance structurée, retire les pavés scrapés.
 */
export function dossierForPersistence(dossier: ResearchDossier): ResearchDossier {
  return {
    ...dossier,
    sources: dossier.sources.map((s) => ({
      ...s,
      excerpt: s.excerpt ? s.excerpt.slice(0, 400) : undefined,
    })),
    collectedDocuments: (dossier.collectedDocuments || []).map((d) => ({
      ...d,
      excerpt: d.excerpt.slice(0, 400),
    })),
  };
}

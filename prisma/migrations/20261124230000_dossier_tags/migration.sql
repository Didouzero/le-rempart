-- Sujets des enquêtes Rempart+ (pages /sujets/[slug]). Ajout pur : aucune table existante modifiée.
CREATE TABLE "DossierTag" (
    "dossierId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "DossierTag_pkey" PRIMARY KEY ("dossierId", "tagId")
);

CREATE INDEX "DossierTag_tagId_idx" ON "DossierTag"("tagId");

ALTER TABLE "DossierTag" ADD CONSTRAINT "DossierTag_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "SpecialDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DossierTag" ADD CONSTRAINT "DossierTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

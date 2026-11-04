-- Numéro court des enquêtes (/dossiers/N), sur le modèle de Article.publicId.
ALTER TABLE "SpecialDossier" ADD COLUMN "publicId" INTEGER;

-- Les enquêtes existantes sont numérotées dans l'ordre de publication.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY COALESCE("publishedAt", "createdAt"), "createdAt", "id") AS n
  FROM "SpecialDossier"
)
UPDATE "SpecialDossier" d SET "publicId" = ranked.n FROM ranked WHERE d."id" = ranked."id";

CREATE SEQUENCE "SpecialDossier_publicId_seq" OWNED BY "SpecialDossier"."publicId";
SELECT setval('"SpecialDossier_publicId_seq"', COALESCE((SELECT MAX("publicId") FROM "SpecialDossier"), 0) + 1, false);
ALTER TABLE "SpecialDossier" ALTER COLUMN "publicId" SET DEFAULT nextval('"SpecialDossier_publicId_seq"');
ALTER TABLE "SpecialDossier" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "SpecialDossier_publicId_key" ON "SpecialDossier"("publicId");

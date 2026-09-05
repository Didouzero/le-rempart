-- Newsletter, Rempart+, dossiers spéciaux
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'past_due', 'canceled', 'incomplete');

CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'article',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");
CREATE INDEX "NewsletterSubscriber_unsubscribedAt_createdAt_idx" ON "NewsletterSubscriber"("unsubscribedAt", "createdAt");

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'incomplete',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Membership_email_key" ON "Membership"("email");
CREATE UNIQUE INDEX "Membership_stripeCustomerId_key" ON "Membership"("stripeCustomerId");
CREATE UNIQUE INDEX "Membership_stripeSubscriptionId_key" ON "Membership"("stripeSubscriptionId");
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

CREATE TABLE "SpecialDossier" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "membersOnly" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialDossier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecialDossier_slug_key" ON "SpecialDossier"("slug");
CREATE INDEX "SpecialDossier_publishedAt_idx" ON "SpecialDossier"("publishedAt");

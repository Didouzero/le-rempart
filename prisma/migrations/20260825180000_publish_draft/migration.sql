-- CreateTable
CREATE TABLE "PublishDraft" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "headline" TEXT NOT NULL,
    "imageMime" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublishDraft_chatId_key" ON "PublishDraft"("chatId");

-- CreateIndex
CREATE INDEX "PublishDraft_createdAt_idx" ON "PublishDraft"("createdAt");

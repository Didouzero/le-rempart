-- TikTok Droitocratie : drafts, jobs, assets
CREATE TABLE "TiktokDraft" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'awaiting_url',
    "sourceUrl" TEXT,
    "extraMedia" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TiktokDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TiktokDraft_chatId_key" ON "TiktokDraft"("chatId");
CREATE INDEX "TiktokDraft_createdAt_idx" ON "TiktokDraft"("createdAt");

CREATE TABLE "TiktokJob" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "extraMedia" JSONB NOT NULL DEFAULT '[]',
    "phase" TEXT NOT NULL DEFAULT 'scrape',
    "progress" TEXT,
    "error" TEXT,
    "title" TEXT,
    "scriptText" TEXT,
    "caption" TEXT,
    "scenes" JSONB,
    "durationMs" INTEGER,
    "renderUrl" TEXT,
    "creatomateId" TEXT,
    "fileToken" TEXT NOT NULL,
    "tiktokPublishId" TEXT,
    "tiktokMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TiktokJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TiktokJob_fileToken_key" ON "TiktokJob"("fileToken");
CREATE INDEX "TiktokJob_chatId_createdAt_idx" ON "TiktokJob"("chatId", "createdAt");
CREATE INDEX "TiktokJob_phase_createdAt_idx" ON "TiktokJob"("phase", "createdAt");

CREATE TABLE "TiktokAsset" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TiktokAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TiktokAsset_jobId_kind_idx" ON "TiktokAsset"("jobId", "kind");

ALTER TABLE "TiktokAsset" ADD CONSTRAINT "TiktokAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TiktokJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

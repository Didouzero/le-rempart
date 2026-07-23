-- CreateTable
CREATE TABLE "TelegramUpdateLog" (
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUpdateLog_pkey" PRIMARY KEY ("updateId")
);

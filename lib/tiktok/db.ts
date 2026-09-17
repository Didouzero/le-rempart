import { prisma } from "@/lib/prisma";

type TiktokDelegates = {
  tiktokDraft: {
    upsert: (args: {
      where: { chatId: bigint };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<TiktokDraftRow>;
    findUnique: (args: {
      where: { chatId: bigint } | { id: string };
    }) => Promise<TiktokDraftRow | null>;
    update: (args: {
      where: { chatId: bigint } | { id: string };
      data: Record<string, unknown>;
    }) => Promise<TiktokDraftRow>;
    delete: (args: {
      where: { chatId: bigint } | { id: string };
    }) => Promise<TiktokDraftRow>;
  };
  tiktokJob: {
    create: (args: {
      data: Record<string, unknown>;
      select?: { id: true };
    }) => Promise<TiktokJobRow>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<TiktokJobRow>;
    findUnique: (args: {
      where: { id: string };
      select?: Record<string, boolean>;
    }) => Promise<TiktokJobRow | null>;
    findFirst: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<TiktokJobRow | null>;
  };
  tiktokAsset: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<TiktokAssetRow>;
    findUnique: (args: {
      where: { id: string };
      select?: Record<string, unknown>;
    }) => Promise<TiktokAssetRow | null>;
  };
};

export type TiktokDraftRow = {
  id: string;
  chatId: bigint;
  userId: bigint;
  step: string;
  sourceUrl: string | null;
  extraMedia: unknown;
  createdAt: Date;
};

export type TiktokJobRow = {
  id: string;
  chatId: bigint;
  userId: bigint;
  sourceUrl: string;
  extraMedia: unknown;
  phase: string;
  progress: string | null;
  error: string | null;
  title: string | null;
  scriptText: string | null;
  caption: string | null;
  scenes: unknown;
  durationMs: number | null;
  renderUrl: string | null;
  creatomateId: string | null;
  fileToken: string;
  tiktokPublishId: string | null;
  tiktokMode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TiktokAssetRow = {
  id: string;
  jobId: string;
  kind: string;
  mime: string;
  data: Uint8Array;
  job?: { fileToken: string };
};

export function tiktokModels(): TiktokDelegates {
  const p = prisma as unknown as Partial<TiktokDelegates>;
  if (!p.tiktokDraft || !p.tiktokJob || !p.tiktokAsset) {
    throw new Error(
      "Client Prisma trop ancien pour TikTok. Lance `npx prisma generate` puis `npx prisma migrate deploy`.",
    );
  }
  return p as TiktokDelegates;
}

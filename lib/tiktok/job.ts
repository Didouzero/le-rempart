import { randomBytes } from "crypto";
import { waitUntil } from "@vercel/functions";
import type { Prisma } from "@prisma/client";
import { fetchSourceText } from "@/lib/fetch-source";
import { tiktokModels } from "@/lib/tiktok/db";
import { telegramSendMessage } from "@/lib/telegram";
import {
  TIKTOK_MAX_EXCERPT_SEC,
  TIKTOK_TTS_MAX_ATTEMPTS,
  canPostToTikTok,
  formatDuration,
  isDurationInTarget,
  type TiktokExtraMedia,
  type TiktokJobPhase,
  type TiktokScene,
  type TiktokScript,
} from "@/lib/tiktok/types";
import { writeDroitocratieScript } from "@/lib/tiktok/script";
import { synthesizeJournalistVoice } from "@/lib/tiktok/voice";
import {
  buildTimelineClips,
  saveVoiceAsset,
  tiktokAssetPublicUrl,
} from "@/lib/tiktok/media";
import { startCreatomateRender } from "@/lib/tiktok/render";
import {
  fetchTiktokPublishStatus,
  publishJobToTikTok,
} from "@/lib/tiktok/publish";
import { sendTiktokPreview } from "@/lib/tiktok/telegram-preview";

export function scheduleTiktokJob(work: Promise<unknown>): void {
  waitUntil(
    Promise.resolve(work).catch((err) => {
      console.error("tiktok job continuation", err);
    }),
  );
}

function parseExtra(raw: unknown): TiktokExtraMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean) as TiktokExtraMedia[];
}

async function setPhase(
  jobId: string,
  phase: TiktokJobPhase,
  extra?: {
    progress?: string;
    error?: string;
    title?: string;
    scriptText?: string;
    caption?: string;
    scenes?: TiktokScene[];
    durationMs?: number;
    renderUrl?: string;
    creatomateId?: string;
    tiktokPublishId?: string;
    tiktokMode?: string;
  },
): Promise<void> {
  await tiktokModels().job.update({
    where: { id: jobId },
    data: {
      phase,
      progress: extra?.progress,
      error: extra?.error,
      title: extra?.title,
      scriptText: extra?.scriptText,
      caption: extra?.caption,
      scenes: extra?.scenes as Prisma.InputJsonValue | undefined,
      durationMs: extra?.durationMs,
      renderUrl: extra?.renderUrl,
      creatomateId: extra?.creatomateId,
      tiktokPublishId: extra?.tiktokPublishId,
      tiktokMode: extra?.tiktokMode,
    },
  });
}

async function notify(chatId: number, text: string): Promise<void> {
  try {
    await telegramSendMessage(chatId, text);
  } catch (err) {
    console.error("tiktok telegram notify", err);
  }
}

export async function createTiktokJob(input: {
  chatId: number;
  userId: number;
  sourceUrl: string;
  extraMedia: TiktokExtraMedia[];
}): Promise<{ id: string }> {
  const row = await tiktokModels().job.create({
    data: {
      chatId: BigInt(input.chatId),
      userId: BigInt(input.userId),
      sourceUrl: input.sourceUrl.slice(0, 2000),
      extraMedia: input.extraMedia as Prisma.InputJsonValue,
      phase: "scrape",
      fileToken: randomBytes(24).toString("hex"),
    },
    select: { id: true },
  });
  return row;
}

export async function runTiktokJob(jobId: string): Promise<void> {
  const job = await tiktokModels().job.findUnique({ where: { id: jobId } });
  if (!job) return;
  const chatId = Number(job.chatId);

  try {
    await setPhase(jobId, "scrape", { progress: "Lecture de l’article…" });
    await notify(chatId, "Lecture de l’article source…");
    const sourceText = await fetchSourceText(job.sourceUrl);
    if (sourceText.length < 80) {
      throw new Error("Article source trop court ou illisible.");
    }

    await setPhase(jobId, "script", { progress: "Écriture voix off Droitocratie…" });
    await notify(chatId, "Écriture du script voix off Droitocratie…");

    let script: TiktokScript = await writeDroitocratieScript({
      sourceUrl: job.sourceUrl,
      sourceText,
    });
    let durationMs = 0;
    let audio: Buffer = Buffer.alloc(0) as Buffer;
    let mime = "audio/mpeg";

    await setPhase(jobId, "voice", {
      progress: "Voix journaliste…",
      title: script.title,
      scriptText: script.script,
      caption: script.caption,
      scenes: script.scenes,
    });
    await notify(chatId, "Génération de la voix off journaliste…");

    for (let attempt = 1; attempt <= TIKTOK_TTS_MAX_ATTEMPTS; attempt++) {
      const voice = await synthesizeJournalistVoice(script.script);
      audio = Buffer.from(voice.audio);
      mime = voice.mime;
      durationMs = voice.durationMs;
      if (isDurationInTarget(durationMs)) break;
      if (attempt === TIKTOK_TTS_MAX_ATTEMPTS) break;
      const adjust = durationMs < 62_000 ? "lengthen" : "shorten";
      await notify(
        chatId,
        `Voix ${formatDuration(durationMs)} (hors cible 1:02–1:20). Ajustement ${attempt}/${TIKTOK_TTS_MAX_ATTEMPTS - 1}…`,
      );
      script = await writeDroitocratieScript({
        sourceUrl: job.sourceUrl,
        sourceText,
        adjust,
        previousScript: script.script,
        previousDurationMs: durationMs,
      });
    }

    if (!isDurationInTarget(durationMs)) {
      throw new Error(
        `Durée voix ${formatDuration(durationMs)} hors fourchette 1:02–1:20 après ${TIKTOK_TTS_MAX_ATTEMPTS} essais.`,
      );
    }

    const voiceAsset = await saveVoiceAsset({ jobId, audio, mime });
    await setPhase(jobId, "media", {
      progress: "Sélection des plans…",
      title: script.title,
      scriptText: script.script,
      caption: script.caption,
      scenes: script.scenes,
      durationMs,
    });
    await notify(
      chatId,
      parseExtra(job.extraMedia).length
        ? `Voix OK (${formatDuration(durationMs)}). Montage avec tes ${parseExtra(job.extraMedia).length} plans (extraits ~${Math.round(TIKTOK_MAX_EXCERPT_SEC)} s)…`
        : `Voix OK (${formatDuration(durationMs)}). Pas de fichier de ta part — visuels d’actu…`,
    );

    const clips = await buildTimelineClips({
      jobId,
      fileToken: job.fileToken,
      extraMedia: parseExtra(job.extraMedia),
      scenes: script.scenes,
      durationSec: durationMs / 1000,
      sourceUrl: job.sourceUrl,
      title: script.title,
    });

    await setPhase(jobId, "render", { progress: "Montage Creatomate…" });
    await notify(chatId, "Montage 9:16 en cours (ça peut prendre 2 à 5 min)…");

    const render = await startCreatomateRender({
      jobId,
      durationSec: durationMs / 1000,
      voiceUrl: tiktokAssetPublicUrl(voiceAsset.id, job.fileToken),
      clips,
    });

    await setPhase(jobId, "render", {
      creatomateId: render.id,
      progress: "Rendu cloud…",
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "échec montage";
    console.error("runTiktokJob", jobId, err);
    await setPhase(jobId, "failed", { error: message, progress: message });
    await notify(chatId, `❌ Droitocratie : ${message}`);
  }
}

export async function completeTiktokRender(input: {
  jobId?: string;
  creatomateId?: string;
  renderUrl: string;
  durationMs?: number;
  error?: string;
}): Promise<void> {
  const job = input.jobId
    ? await tiktokModels().job.findUnique({ where: { id: input.jobId } })
    : input.creatomateId
      ? await tiktokModels().job.findFirst({
          where: { creatomateId: input.creatomateId },
          orderBy: { createdAt: "desc" },
        })
      : null;
  if (!job) {
    console.error("completeTiktokRender: job introuvable", input);
    return;
  }
  if (
    job.phase === "preview" ||
    job.phase === "posted" ||
    job.phase === "cancelled"
  ) {
    return;
  }

  if (input.error) {
    await setPhase(job.id, "failed", { error: input.error });
    await notify(Number(job.chatId), `❌ Rendu vidéo : ${input.error}`);
    return;
  }

  const durationMs = input.durationMs || job.durationMs || 0;
  if (!canPostToTikTok(durationMs)) {
    await setPhase(job.id, "failed", {
      error: `Durée rendu ${formatDuration(durationMs)} ≤ 1:00 — publication bloquée.`,
      renderUrl: input.renderUrl,
      durationMs,
    });
    await notify(
      Number(job.chatId),
      `❌ Vidéo trop courte (${formatDuration(durationMs)}). On ne poste pas ≤ 1:00 pile.`,
    );
    return;
  }

  await setPhase(job.id, "preview", {
    renderUrl: input.renderUrl,
    durationMs,
    progress: "Aperçu prêt",
  });

  await sendTiktokPreview({
    chatId: Number(job.chatId),
    jobId: job.id,
    title: job.title || "Droitocratie",
    caption: job.caption || "",
    durationMs,
    renderUrl: input.renderUrl,
  });
}

export async function publishTiktokJob(jobId: string): Promise<void> {
  const job = await tiktokModels().job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job introuvable.");
  if (job.phase === "posted") throw new Error("Déjà posté.");
  if (job.phase === "cancelled") throw new Error("Job annulé.");
  if (job.phase !== "preview") {
    throw new Error(`Pas d’aperçu (statut : ${job.phase}).`);
  }
  if (!job.renderUrl) throw new Error("Fichier vidéo manquant.");
  if (!canPostToTikTok(job.durationMs || 0)) {
    throw new Error("Durée ≤ 1:00 — publication refusée.");
  }

  await setPhase(jobId, "posting", { progress: "Envoi TikTok…" });
  await notify(Number(job.chatId), "Envoi vers TikTok…");

  try {
    const result = await publishJobToTikTok({
      jobId: job.id,
      fileToken: job.fileToken,
      caption: job.caption || job.title || "Droitocratie",
      renderUrl: job.renderUrl,
    });
    let status = "";
    try {
      status = await fetchTiktokPublishStatus(result.publishId);
    } catch {
      status = "";
    }
    await setPhase(jobId, "posted", {
      tiktokPublishId: result.publishId,
      tiktokMode: result.mode,
      progress: "Posté",
    });
    if (result.mode === "inbox") {
      await notify(
        Number(job.chatId),
        [
          "✅ Brouillon envoyé dans l’inbox TikTok.",
          "Ouvre l’app → notification Inbox pour finaliser la publication.",
          status ? `Statut : ${status}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } else {
      await notify(
        Number(job.chatId),
        [
          "✅ Post TikTok lancé (Direct Post).",
          result.privacy === "SELF_ONLY"
            ? "Visibilité : compte / vidéo privée (app pas encore auditée)."
            : "Visibilité : publique (si l’app est auditée).",
          status ? `Statut : ${status}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "échec TikTok";
    await setPhase(jobId, "preview", { error: message });
    throw err;
  }
}

export async function cancelTiktokJob(jobId: string): Promise<void> {
  await tiktokModels().job.update({
    where: { id: jobId },
    data: { phase: "cancelled", progress: "Annulé" },
  });
}

export async function redoTiktokJob(jobId: string): Promise<{ id: string }> {
  const job = await tiktokModels().job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job introuvable.");
  await tiktokModels().job.update({
    where: { id: jobId },
    data: { phase: "cancelled", progress: "Remplacé par un nouveau montage" },
  });
  const next = await createTiktokJob({
    chatId: Number(job.chatId),
    userId: Number(job.userId),
    sourceUrl: job.sourceUrl,
    extraMedia: parseExtra(job.extraMedia),
  });
  return next;
}

export async function getLatestPreviewJob(chatId: number) {
  return tiktokModels().job.findFirst({
    where: { chatId: BigInt(chatId), phase: "preview" },
    orderBy: { createdAt: "desc" },
  });
}

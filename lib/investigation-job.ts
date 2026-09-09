import { waitUntil } from "@vercel/functions";
import { randomBytes, randomUUID } from "crypto";
import {
  persistNewInvestigationDossier,
  persistRewrittenInvestigation,
  publishInvestigationFacebook,
} from "@/lib/investigation";
import {
  extractAllHttpUrls,
  extractInvestigationFocus,
} from "@/lib/investigation-draft";
import { prisma } from "@/lib/prisma";
import { collectDeepSources } from "@/lib/research/collect";
import {
  buildDossierFromDocuments,
  mergeDossiers,
} from "@/lib/research/build-dossier";
import {
  evaluateDossierQuality,
  shouldEnrichDossier,
} from "@/lib/research/quality";
import { buildFocusedEntityQueries } from "@/lib/research/web-search";
import {
  emptyResearchDossier,
  type ResearchDossier,
  type SourceDocument,
} from "@/lib/research/types";
import { absoluteUrl } from "@/lib/seo";
import { telegramDownloadFile, telegramSendMessage } from "@/lib/telegram";
import { runWritingAgent } from "@/lib/writing/agent";

/** Budget d’un round Vercel (maxDuration 300s) — pas une limite sur l’enquête. */
const SLICE_MS = 230_000;
const LOCK_STALE_MS = 280_000;
const WATCHDOG_MS = 240_000;
const BUILD_RESERVE_MS = 85_000;
const MAX_RESEARCH_PASSES = 3;

export type InvestigationJobKind = "create" | "rewrite";
export type InvestigationJobPhase =
  | "research"
  | "writing"
  | "save"
  | "facebook"
  | "done"
  | "failed";

export type InvestigationJobArticle = {
  title: string;
  excerpt: string;
  content: string;
};

export type InvestigationJob = {
  id: string;
  token: string;
  kind: InvestigationJobKind;
  prompt: string;
  headline?: string;
  dossierId?: string;
  fileId?: string;
  imageMime?: string;
  chatId?: number;
  phase: InvestigationJobPhase;
  startedAt: number;
  updatedAt: number;
  runningSince: number | null;
  sliceIndex: number;
  watchdogScheduled?: boolean;
  error?: string;
  progress?: string;
  checkpoint: {
    subject: string;
    queries: string[];
    extraSourceUrls: string[];
    sources: SourceDocument[];
    dossier: ResearchDossier | null;
    researchPass: number;
    emptyCollects: number;
    researchComplete?: boolean;
    article?: InvestigationJobArticle;
    url?: string;
    slug?: string;
    title?: string;
  };
};

function jobKey(id: string): string {
  return `investigation:job:${id}`;
}

function isSeedUrl(url: string): boolean {
  return url.startsWith("seed:");
}

function webSources(sources: SourceDocument[]): SourceDocument[] {
  return sources.filter(
    (s) =>
      !isSeedUrl(s.url) &&
      ((s.excerpt || "").trim().length >= 80 || s.scraped),
  );
}

function mergeSourceLists(
  prev: SourceDocument[],
  next: SourceDocument[],
): SourceDocument[] {
  const byUrl = new Map<string, SourceDocument>();
  for (const s of [...prev, ...next]) {
    const key = s.url.split("?")[0]!;
    const existing = byUrl.get(key);
    if (
      !existing ||
      (!existing.scraped && s.scraped) ||
      (s.excerpt || "").length > (existing.excerpt || "").length
    ) {
      byUrl.set(key, s);
    }
  }
  return [...byUrl.values()];
}

function elapsedLabel(startedAt: number): string {
  const min = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
  return `${min} min`;
}

export function investigationJobSelfUrl(): string {
  const vercel = process.env.VERCEL_URL?.replace(/^https?:\/\//, "");
  if (vercel) return `https://${vercel}/api/jobs/investigation`;
  return absoluteUrl("/api/jobs/investigation");
}

function investigationJobHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const cron = process.env.CRON_SECRET?.trim();
  if (cron) headers.Authorization = `Bearer ${cron}`;
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
    headers["x-vercel-set-bypass-cookie"] = "true";
  }
  return headers;
}

/** Garde le travail en vie après la réponse HTTP (relais Vercel). */
export function scheduleInvestigationContinuation(
  work: Promise<unknown>,
): void {
  waitUntil(
    Promise.resolve(work).catch((err) => {
      console.error("investigation continuation", err);
    }),
  );
}

export async function loadInvestigationJob(
  id: string,
): Promise<InvestigationJob | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: jobKey(id) },
  });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as InvestigationJob;
  } catch {
    return null;
  }
}

export async function saveInvestigationJob(
  job: InvestigationJob,
): Promise<void> {
  job.updatedAt = Date.now();
  await prisma.appSetting.upsert({
    where: { key: jobKey(job.id) },
    create: { key: jobKey(job.id), value: JSON.stringify(job) },
    update: { value: JSON.stringify(job) },
  });
}

async function notifyJob(job: InvestigationJob, text: string): Promise<void> {
  job.progress = text;
  await saveInvestigationJob(job);
  if (!job.chatId) return;
  try {
    await telegramSendMessage(job.chatId, text);
  } catch (err) {
    console.error("investigation job telegram", err);
  }
}

export function publicInvestigationJobStatus(job: InvestigationJob): {
  id: string;
  phase: InvestigationJobPhase;
  startedAt: number;
  progress?: string;
  error?: string;
  url?: string;
  slug?: string;
  title?: string;
  dossierId?: string;
} {
  return {
    id: job.id,
    phase: job.phase,
    startedAt: job.startedAt,
    progress: job.progress,
    error: job.error,
    url: job.checkpoint.url,
    slug: job.checkpoint.slug,
    title: job.checkpoint.title,
    dossierId: job.dossierId,
  };
}

export async function createInvestigationJob(input: {
  kind: InvestigationJobKind;
  prompt: string;
  headline?: string;
  dossierId?: string;
  fileId?: string;
  imageMime?: string;
  chatId?: number;
}): Promise<InvestigationJob> {
  const prompt = input.prompt.trim();
  if (prompt.length < 40) {
    throw new Error("Prompt trop court.");
  }
  const { subject, queries } = extractInvestigationFocus(
    prompt,
    input.headline,
  );
  const extraSourceUrls = extractAllHttpUrls(prompt).slice(0, 12);
  const job: InvestigationJob = {
    id: randomUUID(),
    token: randomBytes(24).toString("hex"),
    kind: input.kind,
    prompt,
    headline: input.headline,
    dossierId: input.dossierId,
    fileId: input.fileId,
    imageMime: input.imageMime,
    chatId: input.chatId,
    phase: "research",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    runningSince: null,
    sliceIndex: 0,
    checkpoint: {
      subject,
      queries,
      extraSourceUrls,
      sources: [],
      dossier: null,
      researchPass: 0,
      emptyCollects: 0,
    },
  };
  await saveInvestigationJob(job);
  if (job.dossierId) {
    await cancelSiblingInvestigationJobs(job);
  }
  return job;
}

async function cancelSiblingInvestigationJobs(
  current: InvestigationJob,
): Promise<void> {
  if (!current.dossierId) return;
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: "investigation:job:" } },
  });
  for (const row of rows) {
    let other: InvestigationJob;
    try {
      other = JSON.parse(row.value) as InvestigationJob;
    } catch {
      continue;
    }
    if (other.id === current.id) continue;
    if (other.dossierId !== current.dossierId) continue;
    if (other.phase === "done" || other.phase === "failed") continue;
    other.phase = "failed";
    other.error = "Remplacé par une nouvelle réécriture.";
    other.runningSince = null;
    await saveInvestigationJob(other);
  }
}

export async function kickInvestigationJob(
  jobId: string,
  mode: "slice" | "watchdog" = "slice",
): Promise<boolean> {
  const job = await loadInvestigationJob(jobId);
  if (!job) return false;
  try {
    const res = await fetch(investigationJobSelfUrl(), {
      method: "POST",
      headers: investigationJobHeaders(),
      body: JSON.stringify({ jobId, token: job.token, mode }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("kick investigation job", res.status, body.slice(0, 400));
      if (mode === "slice" && job.chatId) {
        await telegramSendMessage(
          job.chatId,
          `Enquête : le relais interne a répondu HTTP ${res.status}. Le round en cours est sauvé, on n’abandonne pas.`,
        ).catch(() => {});
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error("kick investigation job", err);
    if (mode === "slice" && job.chatId) {
      await telegramSendMessage(
        job.chatId,
        `Enquête : relais interne en échec (${err instanceof Error ? err.message : "réseau"}).`,
      ).catch(() => {});
    }
    return false;
  }
}

export async function resumeStuckInvestigationJobs(): Promise<number> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: "investigation:job:" } },
  });
  let n = 0;
  for (const row of rows) {
    let job: InvestigationJob;
    try {
      job = JSON.parse(row.value) as InvestigationJob;
    } catch {
      continue;
    }
    if (job.phase === "done" || job.phase === "failed") continue;
    if (!investigationJobNeedsResume(job)) continue;
    await kickInvestigationJob(job.id, "slice");
    n += 1;
  }
  return n;
}

export function authorizeInvestigationJobRequest(
  request: Request,
  job: InvestigationJob,
  bodyToken?: string,
): boolean {
  const header = request.headers.get("authorization") || "";
  const cron = process.env.CRON_SECRET?.trim();
  const admin = process.env.ADMIN_SESSION_SECRET?.trim();
  if (cron && header === `Bearer ${cron}`) return true;
  if (admin && header === `Bearer ${admin}`) return true;
  return Boolean(bodyToken && bodyToken === job.token);
}

function jobLocked(job: InvestigationJob): boolean {
  return Boolean(
    job.runningSince && Date.now() - job.runningSince < LOCK_STALE_MS,
  );
}

export function investigationJobNeedsResume(job: InvestigationJob): boolean {
  if (job.phase === "done" || job.phase === "failed") return false;
  if (jobLocked(job)) return false;
  const last = job.runningSince || job.updatedAt || job.startedAt;
  return Date.now() - last >= LOCK_STALE_MS;
}

async function failJob(job: InvestigationJob, error: string): Promise<void> {
  job.phase = "failed";
  job.error = error;
  job.runningSince = null;
  await notifyJob(
    job,
    `❌ Enquête : ${error}\nAucune rédaction à partir du seul brief.`,
  );
}

function ensureDossierFromSources(job: InvestigationJob): void {
  if (job.checkpoint.dossier) return;
  if (webSources(job.checkpoint.sources).length < 2) return;
  const dossier = emptyResearchDossier(
    job.checkpoint.subject,
    job.checkpoint.extraSourceUrls[0],
  );
  dossier.sources = job.checkpoint.sources;
  dossier.missingInformation.push(
    "Dossier structuré incomplet : la rédaction s’appuie sur les extraits web collectés.",
  );
  job.checkpoint.dossier = dossier;
}

function researchReadyToWrite(job: InvestigationJob): boolean {
  const web = webSources(job.checkpoint.sources);
  if (web.length < 2) return false;
  const complete = Boolean(
    job.checkpoint.researchComplete ||
      job.checkpoint.researchPass >= MAX_RESEARCH_PASSES ||
      (job.checkpoint.emptyCollects >= 2 && job.checkpoint.researchPass >= 1),
  );
  if (!complete) return false;
  if (!job.checkpoint.dossier) ensureDossierFromSources(job);
  return Boolean(job.checkpoint.dossier);
}

async function researchSlice(
  job: InvestigationJob,
  deadlineAt: number,
): Promise<void> {
  const { subject, queries, extraSourceUrls } = job.checkpoint;
  const haveUrls = job.checkpoint.sources.map((s) => s.url);
  const collectDeadline = Math.min(deadlineAt - BUILD_RESERVE_MS, deadlineAt);
  const extraQueries = [
    ...queries,
    ...buildFocusedEntityQueries(subject).slice(0, 4),
  ];

  await notifyJob(
    job,
    `Recherche web réelle (round ${job.sliceIndex}, ${elapsedLabel(job.startedAt)}). Pas de limite de durée, pas de raccourci sur le brief.`,
  );

  const collect = await collectDeepSources({
    title: subject,
    extraSourceUrls,
    sourceText: job.prompt.slice(0, 20000),
    extraQueries,
    alreadyHaveUrls: haveUrls,
    fast: false,
    skipWebSearch: false,
    deepLimit: 12,
    deadlineAt: Math.max(Date.now() + 15_000, collectDeadline),
  });

  const before = job.checkpoint.sources.length;
  job.checkpoint.sources = mergeSourceLists(
    job.checkpoint.sources,
    collect.sources,
  );
  const added = job.checkpoint.sources.length - before;
  if (added <= 0) job.checkpoint.emptyCollects += 1;
  else job.checkpoint.emptyCollects = 0;
  await saveInvestigationJob(job);

  const web = webSources(job.checkpoint.sources);
  await notifyJob(
    job,
    `Sources web : ${web.length} (dont ${web.filter((s) => s.scraped).length} pages lues).`,
  );

  if (Date.now() + 70_000 >= deadlineAt) {
    return;
  }

  try {
    const built = await buildDossierFromDocuments({
      subject,
      sourceUrl: extraSourceUrls[0],
      sources: job.checkpoint.sources,
      secondaryCaption: job.prompt.slice(0, 4000),
      fast: false,
      deadlineAt,
    });
    if (
      built.missingInformation.some((m) => /reportée/i.test(m)) &&
      !built.keyFacts.length
    ) {
      return;
    }
    job.checkpoint.dossier = job.checkpoint.dossier
      ? mergeDossiers(job.checkpoint.dossier, built)
      : built;
    job.checkpoint.researchPass += 1;
    job.checkpoint.dossier.sources = mergeSourceLists(
      job.checkpoint.sources,
      job.checkpoint.dossier.sources,
    );
    job.checkpoint.sources = job.checkpoint.dossier.sources;
    await saveInvestigationJob(job);
  } catch (err) {
    console.error("investigation research build", err);
    return;
  }

  const dossier = job.checkpoint.dossier;
  if (!dossier) return;
  const quality = evaluateDossierQuality(dossier);
  const enrich = shouldEnrichDossier(quality);
  if (
    web.length >= 2 &&
    (job.checkpoint.researchPass >= MAX_RESEARCH_PASSES || !enrich)
  ) {
    job.checkpoint.researchComplete = true;
  }
}

async function writingSlice(
  job: InvestigationJob,
  deadlineAt: number,
): Promise<void> {
  const dossier = job.checkpoint.dossier;
  if (!dossier) {
    job.phase = "research";
    return;
  }
  const remaining = deadlineAt - Date.now();
  if (remaining < 70_000) return;

  await notifyJob(
    job,
    `Rédaction de l’enquête (${elapsedLabel(job.startedAt)}, ${webSources(job.checkpoint.sources).length} sources web)…`,
  );

  try {
    const written = await runWritingAgent({
      dossier,
      subjectTitle: job.checkpoint.subject,
      investigation: true,
      editorialBrief: job.prompt.slice(0, 24000),
      timeoutMs: Math.min(200_000, remaining - 15_000),
    });
    if (!written.article?.title || !written.article.content) {
      throw new Error("La rédaction n’a rien produit.");
    }
    job.checkpoint.article = {
      title: written.article.title,
      excerpt: written.article.excerpt,
      content: written.article.content,
    };
    job.phase = "save";
  } catch (err) {
    console.error("investigation writing", err);
    await notifyJob(
      job,
      `Rédaction incomplète (${err instanceof Error ? err.message : "échec"}). On réessaie, toujours avec la recherche web.`,
    );
  }
}

async function saveSlice(job: InvestigationJob): Promise<void> {
  const article = job.checkpoint.article;
  if (!article) {
    job.phase = "writing";
    return;
  }
  await notifyJob(job, "Enregistrement de l’enquête…");
  if (job.kind === "rewrite") {
    if (!job.dossierId) throw new Error("Enquête à réécrire introuvable.");
    const saved = await persistRewrittenInvestigation({
      dossierId: job.dossierId,
      prompt: job.prompt,
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
    });
    job.checkpoint.url = saved.url;
    job.checkpoint.slug = saved.slug;
    job.checkpoint.title = saved.title;
    job.phase = "done";
    await notifyJob(
      job,
      `Enquête réécrite (même lien).\n${saved.title}\n${saved.url}`,
    );
    return;
  }

  const saved = await persistNewInvestigationDossier({
    prompt: job.prompt,
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
  });
  job.dossierId = saved.id;
  job.checkpoint.url = saved.url;
  job.checkpoint.slug = saved.slug;
  job.checkpoint.title = saved.title;
  job.phase = "facebook";
  await notifyJob(
    job,
    `Enquête publiée (Rempart+).\n${saved.title}\n${saved.url}`,
  );
}

async function facebookSlice(job: InvestigationJob): Promise<void> {
  const article = job.checkpoint.article;
  const url = job.checkpoint.url;
  if (!article || !url) {
    job.phase = "done";
    return;
  }
  let creative: { buffer: Buffer; mime: string } | undefined;
  if (job.fileId) {
    try {
      const image = await telegramDownloadFile(job.fileId);
      creative = { buffer: image.buffer, mime: image.mime || job.imageMime || "image/jpeg" };
    } catch (err) {
      console.error("investigation job creative", err);
      await notifyJob(
        job,
        "Facebook : créative Telegram illisible. L’enquête site est déjà en ligne.",
      );
    }
  }
  const notify = async (text: string) => {
    await notifyJob(job, text);
  };
  await publishInvestigationFacebook({
    title: article.title,
    excerpt: article.excerpt,
    content: article.content,
    articleUrl: url,
    sourceText: job.prompt.slice(0, 8000),
    creative,
    notify,
  });
  job.phase = "done";
  await saveInvestigationJob(job);
}

export async function processInvestigationSlice(
  jobId: string,
): Promise<{ continue: boolean; busy?: boolean; phase: InvestigationJobPhase }> {
  const job = await loadInvestigationJob(jobId);
  if (!job) return { continue: false, phase: "failed" };
  if (job.phase === "done" || job.phase === "failed") {
    return { continue: false, phase: job.phase };
  }
  if (jobLocked(job)) {
    return { continue: true, busy: true, phase: job.phase };
  }

  job.runningSince = Date.now();
  job.sliceIndex += 1;
  await saveInvestigationJob(job);

  const deadlineAt = Date.now() + SLICE_MS;

  try {
    if (job.phase === "research") {
      await researchSlice(job, deadlineAt);
      if (researchReadyToWrite(job)) {
        job.checkpoint.researchComplete = true;
        job.phase = "writing";
      }
    } else if (job.phase === "writing") {
      await writingSlice(job, deadlineAt);
    }

    if (job.phase === "save" && deadlineAt - Date.now() > 40_000) {
      await saveSlice(job);
    }
    if (job.phase === "facebook" && deadlineAt - Date.now() > 55_000) {
      await facebookSlice(job);
    }
  } catch (err) {
    console.error("investigation slice", err);
    await failJob(
      job,
      err instanceof Error ? err.message : "échec inattendu",
    );
    return { continue: false, phase: "failed" };
  }

  job.runningSince = null;
  await saveInvestigationJob(job);
  const latest = (await loadInvestigationJob(jobId)) || job;
  return {
    continue: latest.phase !== "done" && latest.phase !== "failed",
    phase: latest.phase,
  };
}

export async function runInvestigationWatchdog(jobId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, WATCHDOG_MS));
  const job = await loadInvestigationJob(jobId);
  if (!job || job.phase === "done" || job.phase === "failed") return;
  if (investigationJobNeedsResume(job)) {
    await kickInvestigationJob(jobId, "slice");
  }
  const latest = await loadInvestigationJob(jobId);
  if (latest && latest.phase !== "done" && latest.phase !== "failed") {
    await kickInvestigationJob(jobId, "watchdog");
  }
}

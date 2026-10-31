import { timingSafeEqual } from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import {
  abandonClaudeJob,
  claimClaudeJob,
  claudeJobAction,
  complementMessage,
  isMacOnline,
  loadClaudeJob,
  newArticleMessage,
  newClaudeJob,
  replaceClaudeJob,
  retouchMessage,
  saveClaudeJob,
  sendToClaude,
  startClaudeJob,
  type StoredClaudeJob,
} from "@/lib/claude-job";
import { extractHeadlineFromCreative } from "@/lib/extract-headline";
import { looksLikeReadyArticle, parseReadyArticle } from "@/lib/ready-article";
import {
  ARTICLE_CATEGORIES,
  CATEGORY_META,
  isArticleCategory,
} from "@/lib/categories";
import { isFacebookConfigured } from "@/lib/facebook";
import {
  DISCOVER_MIN_WIDTH,
  downloadIllustration,
  preparedIllustrationWidth,
} from "@/lib/illustration";
import {
  isKimiQuotaError,
  KIMI_QUOTA_USER_MESSAGE,
} from "@/lib/moonshot";
import { prisma } from "@/lib/prisma";
import {
  deletePublishDraft,
  draftHasCover,
  extractHttpUrl,
  getActivePublishDraft,
  type PublishDraftRecord,
  restorePublishDraft,
  setPublishDraftCategory,
  setPublishDraftCoverFile,
  setPublishDraftHeadline,
  upsertPublishDraft,
} from "@/lib/publish-draft";
import {
  publishBriefPipeline,
  publishReadyArticlePipeline,
  telegramNotifier,
} from "@/lib/publish-pipeline";
import {
  isTelegramPromptDocument,
  isTelegramUserAllowed,
  pickLargestPhoto,
  telegramAnswerCallbackQuery,
  telegramDownloadFile,
  telegramDownloadUtf8Text,
  telegramSendMessage,
  type TelegramUpdate,
} from "@/lib/telegram";
import {
  handleVeilleApprovalCommand,
  handleVeilleCallback,
} from "@/lib/veille/approve";

export const runtime = "nodejs";
// Recherche + rédaction Kimi (flash puis article) + Facebook : plusieurs minutes.
export const maxDuration = 800;

/** Normalise `/veille_on@MonBot` → `/veille_on`. */
function normalizeCommand(text: string): string {
  const raw = text.trim().split(/\s+/)[0] || "";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/@\w+$/i, "");
}

function illustrationPromptLines(): string[] {
  return [
    "Envoie l’illustration de l’article en FICHIER (JPG, PNG ou WebP) : trombone › Fichier, pour garder la pleine qualité.",
    "Au moins 1 200 px de large, idéal 1600×900 (16:9). Elle sera hébergée sur le site.",
    "Facultatif : écris la légende et le crédit dans la légende du fichier (ex. « Sébastien Lecornu à Matignon, le 26 octobre. Photo : AFP »).",
  ];
}

const CATEGORY_QUESTION = "📂 Dans quelle rubrique publier cette news ?";

/** Un bouton par rubrique du site ; le choix revient toujours à l'éditeur. */
function categoryKeyboard() {
  const buttons = ARTICLE_CATEGORIES.map((key) => ({
    text: CATEGORY_META[key].label,
    callback_data: `cat:${key}`,
  }));
  return { inline_keyboard: [buttons.slice(0, 3), buttons.slice(3)] };
}

/** Enregistre l'illustration (hébergée sur le site) et signale si elle est trop petite pour Discover. */
async function saveCoverAndAskSubject(
  chatId: number,
  image: { buffer: Buffer; mime: string },
  caption?: string,
): Promise<void> {
  const width = await preparedIllustrationWidth(image.buffer);
  const saved = await setPublishDraftCoverFile(chatId, image, caption);
  if (!saved) throw new Error("Illustration non enregistrée");
  const sizeNote =
    width && width < DISCOVER_MIN_WIDTH
      ? `\n⚠️ Elle ne fait que ${width} px de large : Google Discover demande au moins ${DISCOVER_MIN_WIDTH} px. Renvoie-en une plus grande (en fichier) si tu en as une, sinon continue.`
      : "";
  await telegramSendMessage(
    chatId,
    `Illustration enregistrée${width ? ` (${width} px de large)` : ""}.${caption?.trim() ? `\nLégende : « ${caption.trim().slice(0, 200)} »` : ""}${sizeNote}\n\n${CATEGORY_QUESTION}`,
    { reply_markup: categoryKeyboard() },
  );
}

const SUBJECT_QUESTION = [
  "🧭 Sur quel sujet doit porter ce flash ?",
  "",
  "Donne-moi l’événement, le lieu, la date, l’angle à prendre, des noms ou des sources si tu en as. Claude cherche, rédige et publie depuis le Mac.",
  "",
  "/cancel pour annuler.",
].join("\n");

function commandsHelpText(): string {
  return [
    "📘 COMMANDES LE REMPART",
    "",
    "── Manuel (toujours dispo) ──",
    "1) Envoie une créative PNG/JPG",
    "2) Envoie l’illustration du site en fichier (JPG, PNG, WebP), 1 200 px de large minimum",
    "3) Choisis la rubrique avec les boutons",
    "4) Décris le sujet en texte libre (angle, noms, liens si tu en as)",
    "→ Claude cherche, rédige et publie (site + Facebook) depuis le Mac",
    "Mac indisponible : le bot te propose Kimi, réponds « kimi » pour confirmer",
    "Texte déjà prêt : envoie le fichier .txt à la place du sujet",
    "/cancel — annuler la créative ou l’article en cours",
    "",
    "── Veille auto ──",
    "/veille_on — active l’agent (1 créneau/jour ~8h Paris, limite Hobby Vercel)",
    "/veille_off — coupe l’agent (manuel seul)",
    "/veille — statut (+ créative en attente si besoin)",
    "",
    "── Validation d’une créative auto ──",
    "/veille_ok — publier la proposition en attente",
    "/veille_non — refuser (nouvelle proposition, max 3/créneau)",
    "Boutons ✅ / ❌ sous la photo = même effet",
    "",
    "── Autres ──",
    "/fb — tester la connexion Facebook",
    "/fb_retry — republier le dernier article sur Facebook (dans les 24 h)",
    "/fb_retry 69 — republier l’article #69 sur Facebook",
    "/id — afficher ton user id Telegram",
    "/help ou /commandes — cette liste",
    "",
    "── Enquête Rempart+ (mercredi / samedi) ──",
    "/enquete — démarre une enquête",
    "1) Envoie la créative Facebook (PNG/JPG)",
    "2) Envoie le prompt : un message, ou un fichier .txt si c’est trop long",
    "→ dossier payant + post FB (flash) + lien en commentaire épinglé",
    "/enquete_refaire — réécrire entièrement la dernière enquête (même lien, pas de FB)",
    "/enquete_reprendre — reprendre une enquête coincée (garde les sources déjà lues)",
    "/enquete_cancel — abandonner",
    "",
    "Veille auto : 1×/jour vers 8h (heure FR) — plan Vercel Hobby.",
    "Rien n’est publié en auto sans ton OK.",
  ].join("\n");
}

/** Ce que les deux chaînes de publication reprennent du brouillon. */
function draftMedia(chatId: number, draft: PublishDraftRecord) {
  return {
    headline: draft.headline,
    coverImageUrl: draft.coverImageUrl || undefined,
    coverCaption: draft.coverCaption || undefined,
    category: draft.category || undefined,
    coverImage:
      draft.coverImageData && draft.coverImageData.length > 0
        ? {
            buffer: draft.coverImageData,
            mime: draft.coverImageMime || "image/jpeg",
          }
        : undefined,
    image: { buffer: draft.imageData, mime: draft.imageMime },
    notify: telegramNotifier(chatId),
  };
}

async function publishWithKimi(
  chatId: number,
  draft: PublishDraftRecord,
  brief: string,
): Promise<void> {
  await telegramSendMessage(
    chatId,
    "Sujet reçu. Kimi cherche, rédige et publie (2 à 5 min).",
  );
  // Supprimé d'abord : un second message pendant la rédaction ne relance pas une publication.
  await deletePublishDraft(chatId);
  try {
    await publishBriefPipeline({ ...draftMedia(chatId, draft), brief });
  } catch (err) {
    // Échec avant publication : on remet le brouillon pour pouvoir renvoyer le sujet.
    await restorePublishDraft(draft);
    throw err;
  }
}

/** Mac disponible : le sujet part dans la file. Sinon le bot le garde et propose Kimi. */
async function routeSubject(
  chatId: number,
  draft: PublishDraftRecord,
  subject: string,
): Promise<void> {
  const fields = {
    chatId,
    headline: draft.headline,
    subject,
    category: draft.category,
  };
  if (await isMacOnline(chatId)) {
    const job = newClaudeJob({ ...fields, state: "writing" });
    const label = draft.category ? CATEGORY_META[draft.category].label : "non choisie";
    await startClaudeJob(job, newArticleMessage(job, label));
    await telegramSendMessage(
      chatId,
      "Sujet reçu. Claude cherche et rédige sur le Mac, puis publie directement.\n\nS’il ne répond pas, envoie « kimi » pour lui confier le sujet, ou /cancel pour abandonner.",
    );
    return;
  }
  await saveClaudeJob(newClaudeJob({ ...fields, state: "kimi-offer" }));
  await telegramSendMessage(
    chatId,
    "Le Mac n’est pas disponible : Claude ne peut pas rédiger pour l’instant.\n\nRéponds « kimi » pour que Kimi rédige et publie sans relecture, ou renvoie le sujet quand le Mac est rallumé. /cancel pour abandonner.",
  );
}

const CLAUDE_JOB_STATUS = {
  "kimi-offer":
    "Sujet en attente, le Mac n’était pas disponible. Réponds « kimi » pour que Kimi rédige, renvoie le sujet pour réessayer Claude, ou /cancel.",
  writing:
    "Claude rédige. Le texte arrivera ici. « kimi » pour lui confier le sujet, /cancel pour abandonner.",
  ready:
    "Un texte attend ta réponse : « ok » pour publier, ou dis ce qu’il faut changer. /cancel pour abandonner.",
};

/** Traite le message si un article est en cours. Rien ne se publie ici sans le « ok ». */
async function handleClaudeJob(
  chatId: number,
  text: string,
  stored: StoredClaudeJob,
): Promise<void> {
  const { job } = stored;
  const online = await isMacOnline(chatId);
  const action = claudeJobAction(job.state, text, online);
  const draft = await getActivePublishDraft(chatId);

  if (!draft) {
    await abandonClaudeJob(stored);
    await telegramSendMessage(
      chatId,
      "Le brouillon de cet article n’existe plus. Renvoie la créative pour recommencer.",
    );
    return;
  }

  if (action === "publish") {
    const ready = parseReadyArticle(job.text || "");
    if (!(await claimClaudeJob(stored))) {
      await telegramSendMessage(
        chatId,
        "Le texte vient de changer : relis la dernière version avant de répondre « ok ».",
      );
      return;
    }
    await telegramSendMessage(chatId, "Validé. Je publie ce texte sur le site et Facebook.");
    await deletePublishDraft(chatId);
    try {
      await publishReadyArticlePipeline({ ...draftMedia(chatId, draft), ready });
    } catch (err) {
      await restorePublishDraft(draft);
      await saveClaudeJob(job);
      throw err;
    }
    return;
  }

  if (action === "kimi") {
    await abandonClaudeJob(stored);
    await publishWithKimi(chatId, draft, job.subject);
    return;
  }

  if (action === "new-subject") {
    if (text.trim().length < 10) {
      await telegramSendMessage(chatId, CLAUDE_JOB_STATUS["kimi-offer"]);
      return;
    }
    await routeSubject(chatId, draft, text.trim());
    return;
  }

  if (action === "retouch") {
    if (!(await replaceClaudeJob(stored, { ...job, state: "writing" }))) {
      await telegramSendMessage(chatId, "Le texte vient de changer : relis-le, puis renvoie ta demande.");
      return;
    }
    await sendToClaude(retouchMessage(job, text.trim()));
    await telegramSendMessage(
      chatId,
      "Retouche transmise à Claude. La nouvelle version arrivera ici, rien n’est publié entre-temps.",
    );
    return;
  }

  if (action === "complement") {
    await sendToClaude(complementMessage(job, text.trim()));
    await telegramSendMessage(chatId, "Précision transmise à Claude.");
    return;
  }

  if (action === "mac-down") {
    // Retouche jamais faite : la dernière version reste la seule à valider.
    if (job.state === "writing" && job.text) {
      await saveClaudeJob({ ...job, state: "ready" });
      await telegramSendMessage(
        chatId,
        "Le Mac n’est plus disponible : la retouche n’a pas été faite.\n\n« ok » publie la dernière version reçue telle quelle, « kimi » fait tout réécrire et publier sans relecture, /cancel abandonne.",
      );
      return;
    }
    await telegramSendMessage(
      chatId,
      "Le Mac n’est pas disponible : ton message n’a pas été transmis. Renvoie-le quand il est rallumé, ou réponds « kimi » pour que Kimi rédige et publie sans relecture. /cancel pour abandonner.",
    );
    return;
  }

  await telegramSendMessage(
    chatId,
    action === "not-ready"
      ? "Claude n’a pas encore envoyé de texte à valider : rien n’est publié."
      : CLAUDE_JOB_STATUS[job.state],
  );
}

type ClaimResult = "claimed" | "duplicate" | "db_down";

/** Claim update_id — si déjà vu, ignore (coupe les retries Telegram). */
async function claimUpdate(updateId: number): Promise<ClaimResult> {
  try {
    await prisma.telegramUpdateLog.create({
      data: { updateId: BigInt(updateId) },
    });
    return "claimed";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    // Prisma P2002 = unique constraint → vrai doublon Telegram
    if (code === "P2002" || /unique constraint/i.test(msg)) {
      return "duplicate";
    }
    console.error("telegram claimUpdate DB error", err);
    return "db_down";
  }
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  // Boutons inline ✅ / ❌ sur les créatives veille
  if (update.callback_query) {
    const cq = update.callback_query;
    if (cq.from?.is_bot) return;
    const userId = cq.from.id;
    const chatId = cq.message?.chat.id;
    if (!chatId) return;

    if (!isTelegramUserAllowed(userId)) {
      await telegramAnswerCallbackQuery(cq.id, "Non autorisé");
      return;
    }

    const data = cq.data || "";
    if (data.startsWith("cat:")) {
      const key = data.slice(4);
      const draft = await getActivePublishDraft(chatId);
      if (!draft || !isArticleCategory(key)) {
        await telegramAnswerCallbackQuery(cq.id, "Brouillon expiré : renvoie la créative");
        return;
      }
      await setPublishDraftCategory(chatId, key);
      await telegramAnswerCallbackQuery(cq.id, `Rubrique : ${CATEGORY_META[key].label}`);
      await telegramSendMessage(
        chatId,
        `Rubrique : ${CATEGORY_META[key].label}.\n\n${SUBJECT_QUESTION}`,
      );
      return;
    }
    const handled = await handleVeilleCallback(data, chatId, cq.id);
    if (!handled) {
      await telegramAnswerCallbackQuery(cq.id);
    }
    return;
  }

  const message = update.message;
  if (!message?.from || !message.chat) return;
  if ((message.from as { is_bot?: boolean }).is_bot) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = (message.text || "").trim();
  const cmd = text ? normalizeCommand(text) : "";

  try {
    if (cmd === "/start" || cmd === "/id") {
      await telegramSendMessage(
        chatId,
        [
          "Bot Le Rempart prêt.",
          "",
          `Ton user id Telegram : ${userId}`,
          "",
          "Flux manuel :",
          "1) Envoie ta créative Canva (PNG/JPG)",
          "2) Envoie l’illustration de l’article en fichier (JPG, PNG, WebP)",
          "3) Choisis la rubrique avec les boutons",
          "4) Décris le sujet : événement, angle, noms, liens si tu en as",
          "5) Claude cherche, rédige et publie sur le site et Facebook depuis le Mac",
          "",
          "Si le Mac n’est pas disponible, je te propose Kimi : réponds « kimi » pour confirmer.",
          "Texte déjà prêt : envoie le fichier .txt à la place du sujet.",
          "",
          "/cancel pour abandonner une créative ou un article en cours.",
        ].join("\n"),
      );
      return;
    }

    if (cmd === "/help" || cmd === "/commandes" || cmd === "/cmds") {
      await telegramSendMessage(chatId, commandsHelpText());
      return;
    }

    if (
      cmd === "/cancel" ||
      cmd === "/annuler" ||
      text.toLowerCase() === "annuler"
    ) {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }
      const { clearInvestigationSession, getInvestigationSession } =
        await import("@/lib/investigation-draft");
      const inv = await getInvestigationSession(chatId);
      if (inv) {
        await clearInvestigationSession();
        await telegramSendMessage(chatId, "Enquête annulée.");
        return;
      }
      const claudeJob = await loadClaudeJob(chatId);
      if (claudeJob) await abandonClaudeJob(claudeJob);
      const deleted = await deletePublishDraft(chatId);
      await telegramSendMessage(
        chatId,
        deleted
          ? "Brouillon annulé. Renvoie une créative quand tu veux."
          : "Aucun brouillon en attente.",
      );
      return;
    }

    if (
      cmd === "/veille_off" ||
      cmd === "/veille_on" ||
      cmd === "/veille" ||
      cmd === "/veille_status" ||
      cmd === "/veille_ok" ||
      cmd === "/veille_non"
    ) {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }

      if (await handleVeilleApprovalCommand(cmd, chatId)) {
        return;
      }

      const {
        isVeilleEnabled,
        setVeilleEnabled,
      } = await import("@/lib/veille/settings");

      if (cmd === "/veille_off") {
        await setVeilleEnabled(false);
        await telegramSendMessage(
          chatId,
          [
            "Veille : OFF.",
            "L’agent auto est arrêté.",
            "Tu peux toujours envoyer une créative manuelle (PNG/JPG).",
          ].join("\n"),
        );
        return;
      }
      if (cmd === "/veille_on") {
        await setVeilleEnabled(true);
        await telegramSendMessage(
          chatId,
          [
            "Veille : ON.",
            "1 proposition/jour vers 8h (heure FR) — limite plan Hobby Vercel.",
            "Chaque créative attend ton OK (/veille_ok) — max 3 essais si tu refuses.",
            "Le manuel (créative, illustration, sujet) reste toujours possible.",
          ].join("\n"),
        );
        return;
      }
      const on = await isVeilleEnabled();
      const { getLatestPendingVeille } = await import("@/lib/veille/approve");
      const pending = await getLatestPendingVeille();
      const pendingLine = pending
        ? `\n\n⏳ 1 créative en attente → /veille_ok ou /veille_non`
        : "";
      await telegramSendMessage(
        chatId,
        (on
          ? "Statut veille : ON\n→ auto aux créneaux + validation\n→ manuel toujours OK"
          : "Statut veille : OFF\n→ auto coupé\n→ manuel seul") + pendingLine,
      );
      return;
    }

    if (cmd === "/fb" || cmd === "/facebook") {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }
      if (!isFacebookConfigured()) {
        await telegramSendMessage(
          chatId,
          "Facebook non configuré sur Vercel (FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN).",
        );
        return;
      }
      try {
        const { assertFacebookPageToken } = await import("@/lib/facebook");
        const page = await assertFacebookPageToken();
        await telegramSendMessage(
          chatId,
          `Facebook OK.\nPage : ${page.name}\nID : ${page.id}`,
        );
      } catch (err) {
        await telegramSendMessage(
          chatId,
          `Facebook KO — ${err instanceof Error ? err.message : "token invalide"}`,
        );
      }
      return;
    }

    if (
      cmd === "/fb_retry" ||
      cmd === "/facebook_retry" ||
      cmd === "/fbretry"
    ) {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }
      const parts = text.trim().split(/\s+/);
      const maybeId = parts[1] ? Number(parts[1]) : NaN;
      const publicId =
        Number.isFinite(maybeId) && maybeId > 0 ? Math.floor(maybeId) : undefined;

      try {
        const { republishArticleToFacebook } = await import(
          "@/lib/facebook-retry"
        );
        await republishArticleToFacebook({
          publicId,
          notify: telegramNotifier(chatId),
        });
      } catch (err) {
        await telegramSendMessage(
          chatId,
          `❌ /fb_retry : ${err instanceof Error ? err.message : "échec"}`,
        );
      }
      return;
    }

    if (
      cmd === "/enquete" ||
      cmd === "/enquete_ok" ||
      cmd === "/enquete_go" ||
      cmd === "/enquete_cancel" ||
      cmd === "/enquete_annuler" ||
      cmd === "/enquete_refaire" ||
      cmd === "/enquete_redo" ||
      cmd === "/enquete_reprendre" ||
      cmd === "/enquete_resume"
    ) {
      if (!isTelegramUserAllowed(userId)) {
        await telegramSendMessage(
          chatId,
          `Accès non autorisé.\nTon id : ${userId}`,
        );
        return;
      }
      const {
        clearInvestigationSession,
        getInvestigationSession,
        startInvestigationSession,
        startInvestigationRewriteSession,
      } = await import("@/lib/investigation-draft");

      if (cmd === "/enquete_cancel" || cmd === "/enquete_annuler") {
        await clearInvestigationSession();
        await telegramSendMessage(chatId, "Enquête annulée.");
        return;
      }

      if (cmd === "/enquete_ok" || cmd === "/enquete_go") {
        const session = await getInvestigationSession(chatId);
        if (!session) {
          await telegramSendMessage(
            chatId,
            "Aucune enquête en cours. Envoie /enquete, puis la créative, puis le prompt.",
          );
          return;
        }
        if (session.step === "awaiting_creative") {
          await telegramSendMessage(
            chatId,
            "J’attends d’abord la créative Facebook (PNG/JPG).",
          );
          return;
        }
        await telegramSendMessage(
          chatId,
          "Pas besoin de /enquete_ok. Envoie le prompt : un message, ou un fichier .txt.",
        );
        return;
      }

      if (cmd === "/enquete_reprendre" || cmd === "/enquete_resume") {
        const {
          continueInvestigationJobInProcess,
          findActiveInvestigationJobForChat,
          kickInvestigationJob,
          scheduleInvestigationContinuation,
        } = await import("@/lib/investigation-job");
        const job = await findActiveInvestigationJobForChat(chatId);
        if (!job) {
          await telegramSendMessage(
            chatId,
            "Aucune enquête en cours à reprendre. Si tu relances /enquete_refaire, tu perds les sources déjà lues.",
          );
          return;
        }
        await telegramSendMessage(
          chatId,
          `Reprise du checkpoint (${job.checkpoint.sources.length} sources déjà lues, ${Math.round((Date.now() - job.startedAt) / 60000)} min).`,
        );
        scheduleInvestigationContinuation(
          kickInvestigationJob(job.id, "watchdog"),
        );
        await continueInvestigationJobInProcess(job.id, Date.now() + 240_000);
        return;
      }

      if (cmd === "/enquete_refaire" || cmd === "/enquete_redo") {
        const latest = await prisma.specialDossier.findFirst({
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, slug: true },
        });
        if (!latest) {
          await telegramSendMessage(
            chatId,
            "Aucune enquête à réécrire. Lance d’abord /enquete.",
          );
          return;
        }
        await startInvestigationRewriteSession(chatId, latest.id, latest.title);
        await telegramSendMessage(
          chatId,
          [
            `Réécriture intégrale de :`,
            latest.title,
            `https://www.le-rempart.org/dossiers/${latest.slug}`,
            "",
            "Même lien public. Pas de nouveau post Facebook.",
            "Envoie le prompt complet (message ou fichier .txt).",
            "/enquete_cancel pour abandonner.",
          ].join("\n"),
        );
        return;
      }

      await startInvestigationSession(chatId);
      await telegramSendMessage(
        chatId,
        [
          "Enquête : envoie maintenant la créative Facebook (PNG/JPG), comme d’habitude.",
          "",
          "Ensuite je te demanderai un prompt complet (message, ou fichier .txt si trop long).",
          "/enquete_cancel pour abandonner.",
        ].join("\n"),
      );
      return;
    }

    if (!isTelegramUserAllowed(userId)) {
      await telegramSendMessage(
        chatId,
        `Accès non autorisé.\nTon id : ${userId}`,
      );
      return;
    }

    let fileId: string | null = null;
    if (message.photo?.length) {
      fileId = pickLargestPhoto(message.photo);
    } else if (
      message.document?.mime_type?.startsWith("image/") &&
      message.document.file_id
    ) {
      fileId = message.document.file_id;
    }

    const manualCaption = (message.caption || "").trim();

    {
      const {
        clearInvestigationSession,
        getInvestigationSession,
        setInvestigationCreative,
      } = await import("@/lib/investigation-draft");
      const inv = await getInvestigationSession(chatId);
      if (inv) {
        if (fileId && !inv.replaceDossierId) {
          await telegramSendMessage(chatId, "Créative reçue. Lecture du titre…");
          const image = await telegramDownloadFile(fileId);
          let headline = manualCaption;
          if (!headline) {
            try {
              headline = await extractHeadlineFromCreative(image);
              await telegramSendMessage(chatId, `Titre détecté : ${headline}`);
            } catch (err) {
              console.error("investigation headline", err);
              headline = "Enquête Le Rempart";
              await telegramSendMessage(
                chatId,
                isKimiQuotaError(err)
                  ? KIMI_QUOTA_USER_MESSAGE
                  : "Titre illisible sur la créative — on continue. Envoie le prompt.",
              );
            }
          }
          await setInvestigationCreative(chatId, {
            fileId,
            imageMime: image.mime,
            headline,
          });
          await telegramSendMessage(
            chatId,
            [
              "Tape un prompt complet sur ton enquête.",
              "Donne-moi les infos que tu as en amont, les liens éventuels, donne-moi des directives pour que je cherche, un angle d’attaque du dossier, etc.",
              "",
              "Un seul message, ou un fichier .txt si c’est trop long pour Telegram.",
              "/enquete_cancel pour abandonner.",
            ].join("\n"),
          );
          return;
        }

        if (inv.step === "awaiting_creative") {
          await telegramSendMessage(
            chatId,
            "J’attends d’abord la créative Facebook (PNG/JPG).\n/enquete_cancel pour abandonner.",
          );
          return;
        }

        if (inv.step === "awaiting_prompt") {
          let prompt = "";
          const doc = message.document;
          if (doc && isTelegramPromptDocument(doc)) {
            try {
              await telegramSendMessage(chatId, "Fichier reçu. Lecture du prompt…");
              prompt = await telegramDownloadUtf8Text({
                fileId: doc.file_id,
                fileSize: doc.file_size,
              });
            } catch (err) {
              await telegramSendMessage(
                chatId,
                `❌ Fichier : ${err instanceof Error ? err.message : "illisible"}\nEnvoie un .txt UTF-8, ou colle le texte.`,
              );
              return;
            }
          } else if (text && !text.startsWith("/")) {
            prompt = text.trim();
          } else if (doc) {
            await telegramSendMessage(
              chatId,
              "Pour le prompt, envoie un fichier .txt (ou .md), ou colle le texte.\n/enquete_cancel pour abandonner.",
            );
            return;
          }

          if (prompt) {
            if (prompt.length < 40) {
              await telegramSendMessage(
                chatId,
                "Prompt trop court. Un message, ou un .txt, avec infos, liens éventuels, angle et directives de recherche.",
              );
              return;
            }
            if (!inv.fileId && !inv.replaceDossierId) {
              await telegramSendMessage(
                chatId,
                "Il me manque la créative. Renvoie une image PNG/JPG, puis le prompt.",
              );
              return;
            }
            await telegramSendMessage(
              chatId,
              inv.replaceDossierId
                ? "Prompt reçu. Réécriture intégrale (même lien). Recherche web réelle, pas de limite de durée, pas de raccourci sur le brief."
                : "Prompt reçu. Lancement de l’enquête. Recherche web réelle, pas de limite de durée, pas de raccourci sur le brief.",
            );
            try {
              const {
                createInvestigationJob,
                continueInvestigationJobInProcess,
                kickInvestigationJob,
                scheduleInvestigationContinuation,
              } = await import("@/lib/investigation-job");
              const job = await createInvestigationJob(
                inv.replaceDossierId
                  ? {
                      kind: "rewrite",
                      prompt,
                      headline: inv.headline,
                      dossierId: inv.replaceDossierId,
                      chatId,
                    }
                  : {
                      kind: "create",
                      prompt,
                      headline: inv.headline,
                      fileId: inv.fileId,
                      imageMime: inv.imageMime,
                      chatId,
                    },
              );
              await clearInvestigationSession();
              await telegramSendMessage(
                chatId,
                `C’est parti. Round 1 en cours — tu dois recevoir des updates, pas le silence.`,
              );
              scheduleInvestigationContinuation(
                kickInvestigationJob(job.id, "watchdog"),
              );
              await continueInvestigationJobInProcess(
                job.id,
                Date.now() + 240_000,
              );
            } catch (err) {
              await telegramSendMessage(
                chatId,
                `❌ Enquête : ${err instanceof Error ? err.message : "échec"}`,
              );
            }
            return;
          }
        }

        await telegramSendMessage(
          chatId,
          "J’attends le prompt de l’enquête : un message, ou un fichier .txt si c’est trop long.\n/enquete_cancel pour abandonner.",
        );
        return;
      }
    }

    // Un fichier .txt ou un texte prêt continue de passer directement par le flux habituel.
    const claudeJob = await loadClaudeJob(chatId);
    const readyDrop =
      !fileId &&
      (looksLikeReadyArticle(text) ||
        (message.document && isTelegramPromptDocument(message.document)));
    if (claudeJob && !readyDrop) {
      await handleClaudeJob(chatId, text, claudeJob);
      return;
    }

    // ── Étape 1 : créative. 2e image = illustration site (si titre déjà là). ──
    if (fileId) {
      const pendingCover = await getActivePublishDraft(chatId);
      if (
        pendingCover &&
        pendingCover.headline.trim() &&
        !draftHasCover(pendingCover)
      ) {
        try {
          await saveCoverAndAskSubject(
            chatId,
            await telegramDownloadFile(fileId),
            manualCaption,
          );
        } catch (err) {
          await telegramSendMessage(
            chatId,
            `Illustration : ${err instanceof Error ? err.message : "fichier illisible"}. Envoie un fichier JPG, PNG ou WebP.`,
          );
        }
        return;
      }

      await telegramSendMessage(chatId, "Créative reçue. Lecture du titre…");
      const image = await telegramDownloadFile(fileId);

      let headline = manualCaption;
      if (!headline) {
        try {
          headline = await extractHeadlineFromCreative(image);
          await telegramSendMessage(chatId, `Titre détecté : ${headline}`);
        } catch (err) {
          console.error("flash headline", err);
          headline = "";
          if (isKimiQuotaError(err)) {
            await telegramSendMessage(chatId, KIMI_QUOTA_USER_MESSAGE);
          }
        }
      }

      await upsertPublishDraft({
        chatId,
        userId,
        headline,
        image,
      });

      if (!headline) {
        await telegramSendMessage(
          chatId,
          [
            "Créative enregistrée. Tape le titre (un message texte).",
            "Pas besoin de renvoyer l’image.",
            "",
            "/cancel pour annuler.",
          ].join("\n"),
        );
        return;
      }

      await telegramSendMessage(
        chatId,
        [
          ...illustrationPromptLines(),
          "",
          "Ensuite je te demanderai le sujet du flash.",
          "/cancel pour annuler.",
        ].join("\n"),
      );
      return;
    }

    // ── Étapes 2–3 : titre manquant, puis URLs ──
    const draft = await getActivePublishDraft(chatId);
    const url = text ? extractHttpUrl(text) : null;

    if (draft && !draft.headline.trim()) {
      const typed = (text || "").trim();
      if (typed && !url && !text.startsWith("/")) {
        const saved = await setPublishDraftHeadline(chatId, typed);
        if (!saved) {
          await telegramSendMessage(
            chatId,
            "Titre trop court. Envoie le titre en un message texte.\n/cancel pour annuler.",
          );
          return;
        }
        await telegramSendMessage(
          chatId,
          [
            `Titre enregistré : ${saved.headline}`,
            "",
            ...illustrationPromptLines(),
            "",
            "/cancel pour annuler.",
          ].join("\n"),
        );
        return;
      }
      await telegramSendMessage(
        chatId,
        "La créative est déjà là. Tape le titre (un message texte), pas une URL.\n/cancel pour annuler.",
      );
      return;
    }

    if (draft && url && !draftHasCover(draft)) {
      // Un lien est téléchargé puis hébergé sur le site, comme un fichier.
      try {
        // Le texte autour du lien sert de légende.
        const linkCaption = text.replace(url, " ").replace(/\s+/g, " ").trim();
        await saveCoverAndAskSubject(chatId, await downloadIllustration(url), linkCaption);
      } catch (err) {
        await telegramSendMessage(
          chatId,
          `Illustration : ${err instanceof Error ? err.message : "lien illisible"}. Envoie plutôt l’image en fichier (JPG, PNG ou WebP).`,
        );
      }
      return;
    }

    if (draft && !draftHasCover(draft)) {
      await telegramSendMessage(
        chatId,
        [
          "J’attends encore l’illustration : un fichier JPG, PNG ou WebP.",
          `Titre en attente : ${draft.headline.slice(0, 120)}`,
          "",
          "/cancel pour annuler.",
        ].join("\n"),
      );
      return;
    }

    if (draft && !draft.category) {
      await telegramSendMessage(chatId, CATEGORY_QUESTION, {
        reply_markup: categoryKeyboard(),
      });
      return;
    }

    if (draft) {
      const readyDoc =
        message.document && isTelegramPromptDocument(message.document)
          ? message.document
          : null;
      const readyText = readyDoc
        ? await telegramDownloadUtf8Text({
            fileId: readyDoc.file_id,
            fileSize: readyDoc.file_size,
          })
        : text;
      if (looksLikeReadyArticle(readyText)) {
        const ready = parseReadyArticle(readyText);
        await telegramSendMessage(chatId, "Texte prêt reçu. Je publie sans passer par Kimi.");
        if (claudeJob) await abandonClaudeJob(claudeJob);
        await deletePublishDraft(chatId);
        try {
          await publishReadyArticlePipeline({ ...draftMedia(chatId, draft), ready });
        } catch (err) {
          await restorePublishDraft(draft);
          throw err;
        }
        return;
      }

      const brief = text.startsWith("/") ? "" : text;
      if (brief.length < 10) {
        await telegramSendMessage(chatId, SUBJECT_QUESTION);
        return;
      }
      await routeSubject(chatId, draft, brief);
      return;
    }

    await telegramSendMessage(
      chatId,
      "Envoie d’abord une créative (PNG/JPG), puis l’illustration (en fichier), puis le sujet du flash.",
    );
  } catch (err) {
    console.error("telegram process error", err);
    try {
      const raw = err instanceof Error ? err.message : "échec publication";
      const friendly = /aborted due to timeout|AbortError|TimeoutError/i.test(
        raw,
      )
        ? "Timeout (opération trop longue). Renvoie le sujet une fois, sans spammer."
        : /high risk|content_filter|Kimi a bloqué/i.test(raw)
          ? "Kimi a bloqué ce sujet (filtre de contenu). Réessaie avec une autre source, ou reformule le titre."
          : /22021|invalid byte sequence|UTF8/i.test(raw)
            ? "La source n’est pas une page article (souvent un lien image). Envoie l’URL de l’article, pas le .jpg."
            : isKimiQuotaError(raw)
              ? KIMI_QUOTA_USER_MESSAGE
              : raw;
      await telegramSendMessage(chatId, `Erreur : ${friendly}`);
    } catch {
      // ignore
    }
  }
}

/** Sans secret configuré, le bot reste ouvert : l'activer ne doit pas le couper avant Telegram. */
function telegramSecretOk(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const a = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") || "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!telegramSecretOk(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const claim = await claimUpdate(update.update_id);

  if (claim === "duplicate") {
    return NextResponse.json({ ok: true });
  }

  if (claim === "db_down") {
    // Neon/DB down ≠ doublon. 503 → Telegram garde l'update et retentera.
    console.error("telegram webhook: database unavailable, returning 503");
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 },
    );
  }

  after(() => processUpdate(update));
  return NextResponse.json({ ok: true });
}

import { after, NextRequest, NextResponse } from "next/server";
import { extractHeadlineFromCreative } from "@/lib/extract-headline";
import { isFacebookConfigured } from "@/lib/facebook";
import { prisma } from "@/lib/prisma";
import {
  deletePublishDraft,
  extractHttpUrl,
  getActivePublishDraft,
  setPublishDraftCoverUrl,
  upsertPublishDraft,
} from "@/lib/publish-draft";
import {
  publishCreativePipeline,
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
export const maxDuration = 300;

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

function commandsHelpText(): string {
  return [
    "📘 COMMANDES LE REMPART",
    "",
    "── Manuel (toujours dispo) ──",
    "1) Envoie une créative PNG/JPG",
    "2) Envoie l’URL de l’image d’illustration (site)",
    "3) Envoie le lien de l’article source",
    "→ article site + Facebook",
    "/cancel — annuler la créative en attente",
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
    "/fb_retry — republier le dernier article sur Facebook",
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
    "/enquete_cancel — abandonner",
    "",
    "Veille auto : 1×/jour vers 8h (heure FR) — plan Vercel Hobby.",
    "Rien n’est publié en auto sans ton OK.",
  ].join("\n");
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
          "2) Envoie l’URL de l’image pour l’article",
          "3) Envoie le lien de l’article source",
          "4) Je publie l’article site + Facebook",
          "",
          "/cancel pour abandonner une créative en attente.",
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
            "Le manuel (créative puis lien source) reste toujours possible.",
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
      cmd === "/enquete_redo"
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
                "Titre illisible sur la créative — on continue. Envoie le prompt.",
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
          } else if (text && !cmd.startsWith("/")) {
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
                ? "Prompt reçu. Réécriture intégrale (même lien, plusieurs minutes)…"
                : "Prompt reçu. Lancement de l’enquête (recherche + rédaction, plusieurs minutes)…",
            );
            try {
              if (inv.replaceDossierId) {
                const { rewriteInvestigation } = await import(
                  "@/lib/investigation"
                );
                await rewriteInvestigation({
                  dossierId: inv.replaceDossierId,
                  prompt,
                  headline: inv.headline,
                  notify: telegramNotifier(chatId),
                });
              } else {
                const image = await telegramDownloadFile(inv.fileId!);
                const { publishInvestigation } = await import(
                  "@/lib/investigation"
                );
                await publishInvestigation({
                  prompt,
                  headline: inv.headline,
                  creative: { buffer: image.buffer, mime: image.mime },
                  notify: telegramNotifier(chatId),
                });
              }
              await clearInvestigationSession();
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

    // ── Étape 1 : créative → demande URL illustration ──
    if (fileId) {
      await telegramSendMessage(chatId, "Créative reçue. Lecture du titre…");
      const image = await telegramDownloadFile(fileId);

      let headline = manualCaption;
      if (!headline) {
        headline = await extractHeadlineFromCreative(image);
        await telegramSendMessage(chatId, `Titre détecté : ${headline}`);
      }

      await upsertPublishDraft({
        chatId,
        userId,
        headline,
        image,
      });

      await telegramSendMessage(
        chatId,
        [
          "Envoie maintenant l’URL de l’image à mettre dans l’article (http/https).",
          "Exemple : lien direct vers un .jpg / .png (Wikimedia, agence, etc.).",
          "",
          "Ensuite je te demanderai le lien de l’article source.",
          "/cancel pour annuler.",
        ].join("\n"),
      );
      return;
    }

    // ── Étapes 2–3 : URLs alors qu’un brouillon attend ──
    const draft = await getActivePublishDraft(chatId);
    const url = text ? extractHttpUrl(text) : null;

    if (draft && url && !draft.coverImageUrl) {
      await setPublishDraftCoverUrl(chatId, url);
      await telegramSendMessage(
        chatId,
        [
          "Illustration enregistrée.",
          "",
          "Envoie maintenant le lien de l’article source (URL http/https).",
          "Je m’en sers pour rédiger l’article + le flash Facebook.",
          "",
          "/cancel pour annuler.",
        ].join("\n"),
      );
      return;
    }

    if (draft && url && draft.coverImageUrl) {
      await telegramSendMessage(
        chatId,
        `Lien source reçu. Publication en cours…\n${url}`,
      );

      try {
        await publishCreativePipeline({
          caption: draft.headline,
          headline: draft.headline,
          sourceUrl: url,
          coverImageUrl: draft.coverImageUrl,
          image: { buffer: draft.imageData, mime: draft.imageMime },
          requireSource: true,
          notify: telegramNotifier(chatId),
        });
        await deletePublishDraft(chatId);
      } catch (err) {
        // Garde le brouillon pour renvoyer une autre URL source
        throw err;
      }
      return;
    }

    if (draft && !url) {
      await telegramSendMessage(
        chatId,
        [
          draft.coverImageUrl
            ? "J’attends encore le lien de la source (URL complète http/https)."
            : "J’attends encore l’URL de l’image d’illustration (http/https).",
          `Titre en attente : ${draft.headline.slice(0, 120)}`,
          "",
          "/cancel pour annuler.",
        ].join("\n"),
      );
      return;
    }

    await telegramSendMessage(
      chatId,
      "Envoie d’abord une créative (PNG/JPG), puis l’URL image, puis le lien source.",
    );
  } catch (err) {
    console.error("telegram process error", err);
    try {
      const raw = err instanceof Error ? err.message : "échec publication";
      const friendly = /aborted due to timeout|AbortError|TimeoutError/i.test(
        raw,
      )
        ? "Timeout (opération trop longue). Renvoie le lien une fois, sans spammer."
        : raw;
      await telegramSendMessage(chatId, `Erreur : ${friendly}`);
    } catch {
      // ignore
    }
  }
}

export async function POST(request: NextRequest) {
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

/**
 * Approbation Telegram avant publication veille (article + Facebook).
 */

import { prisma } from "@/lib/prisma";
import {
  publishCreativePipeline,
  telegramNotifier,
} from "@/lib/publish-pipeline";
import {
  getAllowedTelegramUserIds,
  telegramAnswerCallbackQuery,
  telegramSendMessage,
} from "@/lib/telegram";
import { setLastVeilleSlot } from "@/lib/veille/settings";
import { runVeilleCycle, VEILLE_MAX_PROPOSALS } from "@/lib/veille/run";

function adminChatId(): number | null {
  const fromEnv = process.env.TELEGRAM_NOTIFY_CHAT_ID?.trim();
  if (fromEnv && Number.isFinite(Number(fromEnv))) return Number(fromEnv);
  const allowed = getAllowedTelegramUserIds();
  return allowed[0] ?? null;
}

export async function getLatestPendingVeille() {
  return prisma.veilleItem.findFirst({
    where: { status: "pending_approval" },
    orderBy: { createdAt: "desc" },
  });
}

async function countSkippedForSlot(slotKey: string): Promise<number> {
  return prisma.veilleItem.count({
    where: { slotKey, status: "skipped" },
  });
}

export async function approveVeilleItem(
  itemId: string,
  opts?: { chatId?: number },
): Promise<{ ok: boolean; message: string; articleUrl?: string }> {
  const item = await prisma.veilleItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, message: "Proposition introuvable." };
  if (item.status !== "pending_approval") {
    return {
      ok: false,
      message: `Statut actuel : ${item.status} (pas en attente).`,
    };
  }
  if (!item.creativeImageData || !item.canvaTitle) {
    return { ok: false, message: "Créative manquante en base." };
  }

  const chatId = opts?.chatId ?? adminChatId();
  const notify = chatId
    ? telegramNotifier(chatId)
    : async (t: string) => console.log("[veille-approve]", t);

  await notify("✅ Validation reçue. Publication en cours…");

  try {
    const png = Buffer.from(item.creativeImageData);
    const result = await publishCreativePipeline({
      caption: item.canvaTitle,
      // Entrée principale Knowledge Builder — plus la caption seule.
      sourceUrl: item.sourceUrl || undefined,
      sourceTitle: item.sourceTitle || undefined,
      headline: item.headline,
      image: {
        buffer: png,
        mime: item.creativeImageMime || "image/png",
      },
      notify,
    });

    await prisma.veilleItem.update({
      where: { id: item.id },
      data: {
        status: "published",
        articleId: result.article.id,
        creativeImageData: null,
        errorMessage: null,
      },
    });

    if (item.slotKey) {
      await setLastVeilleSlot(item.slotKey);
    }

    return {
      ok: true,
      message: "Publié",
      articleUrl: result.article.url,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "échec publication";
    await prisma.veilleItem.update({
      where: { id: item.id },
      data: { status: "failed", errorMessage: msg.slice(0, 500) },
    });
    await notify(`❌ Veille : échec après validation\n${msg}`);
    return { ok: false, message: msg };
  }
}

export async function rejectVeilleItem(
  itemId: string,
  opts?: { chatId?: number },
): Promise<{ ok: boolean; message: string }> {
  const item = await prisma.veilleItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, message: "Proposition introuvable." };
  if (item.status !== "pending_approval") {
    return {
      ok: false,
      message: `Statut actuel : ${item.status} (pas en attente).`,
    };
  }

  await prisma.veilleItem.update({
    where: { id: item.id },
    data: {
      status: "skipped",
      creativeImageData: null,
      errorMessage: "Refusé par validation Telegram",
    },
  });

  const chatId = opts?.chatId ?? adminChatId();
  const slotKey = item.slotKey;
  const skipped = slotKey ? await countSkippedForSlot(slotKey) : VEILLE_MAX_PROPOSALS;

  if (slotKey && skipped < VEILLE_MAX_PROPOSALS) {
    if (chatId) {
      await telegramSendMessage(
        chatId,
        [
          `❌ Créative refusée (${skipped}/${VEILLE_MAX_PROPOSALS}).`,
          (item.canvaTitle || item.headline).slice(0, 180),
          "",
          "Je propose une autre créative…",
        ].join("\n"),
      );
    }
    // Nouvelle proposition même créneau (hors check horaire)
    const retry = await runVeilleCycle({
      force: true,
      slotKeyOverride: slotKey,
    });
    if (!retry.ok && chatId) {
      await telegramSendMessage(
        chatId,
        [
          `Plus d'autre sujet auto pour ce créneau (${retry.message}).`,
          "Tu peux envoyer ta créative manuelle en PNG/JPG ici — ça publie toujours, veille ON ou OFF.",
        ].join("\n"),
      );
      await setLastVeilleSlot(slotKey);
    }
    return { ok: true, message: "Refusé — nouvelle proposition" };
  }

  if (slotKey) {
    await setLastVeilleSlot(slotKey);
  }

  if (chatId) {
    await telegramSendMessage(
      chatId,
      [
        `❌ ${VEILLE_MAX_PROPOSALS} créatives refusées pour ce créneau — rien n'a été publié.`,
        "",
        "Envoie ta créative manuelle en PNG/JPG ici si tu veux publier (toujours possible, veille ON ou OFF).",
      ].join("\n"),
    );
  }

  return { ok: true, message: "Refusé — quota créneau atteint" };
}

export async function handleVeilleApprovalCommand(
  text: string,
  chatId: number,
): Promise<boolean> {
  const raw = text.trim().split(/\s+/)[0] || "";
  const cmd = (raw.startsWith("/") ? raw : `/${raw}`)
    .toLowerCase()
    .replace(/@\w+$/i, "");
  if (cmd !== "/veille_ok" && cmd !== "/veille_non") return false;

  const pending = await getLatestPendingVeille();
  if (!pending) {
    await telegramSendMessage(
      chatId,
      "Aucune créative veille en attente de validation.",
    );
    return true;
  }

  if (cmd === "/veille_ok") {
    await approveVeilleItem(pending.id, { chatId });
  } else {
    await rejectVeilleItem(pending.id, { chatId });
  }
  return true;
}

export async function handleVeilleCallback(
  data: string,
  chatId: number,
  callbackQueryId: string,
): Promise<boolean> {
  // veille:ok:<id> | veille:no:<id>
  const match = data.match(/^veille:(ok|no):([a-z0-9]+)$/i);
  if (!match) return false;

  const [, action, id] = match;
  if (action === "ok") {
    await telegramAnswerCallbackQuery(callbackQueryId, "Publication…");
    await approveVeilleItem(id, { chatId });
  } else {
    await telegramAnswerCallbackQuery(callbackQueryId, "Refusé");
    await rejectVeilleItem(id, { chatId });
  }
  return true;
}

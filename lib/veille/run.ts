import {
  fetchCreativeBackground,
  renderRempartCreative,
} from "@/lib/creative";
import { prisma } from "@/lib/prisma";
import { telegramNotifier } from "@/lib/publish-pipeline";
import {
  getAllowedTelegramUserIds,
  telegramSendPhoto,
  veilleApprovalKeyboard,
} from "@/lib/telegram";
import { currentVeilleSlot } from "@/lib/veille/schedule";
import { headlineKey, scrapeHotNews } from "@/lib/veille/scrape";
import { scoreAndPickStory } from "@/lib/veille/score";
import {
  getLastVeilleSlot,
  isVeilleEnabled,
} from "@/lib/veille/settings";

export type VeilleRunResult = {
  ok: boolean;
  message: string;
  articleUrl?: string;
  score?: number;
  slotKey?: string;
  pendingId?: string;
};

function adminChatId(): number | null {
  const fromEnv = process.env.TELEGRAM_NOTIFY_CHAT_ID?.trim();
  if (fromEnv && Number.isFinite(Number(fromEnv))) return Number(fromEnv);
  const allowed = getAllowedTelegramUserIds();
  return allowed[0] ?? null;
}

/**
 * Un cycle de veille : scrape → score → créative → envoi Telegram pour validation.
 * Publication site+FB uniquement après /veille_ok (ou bouton ✅).
 */
export async function runVeilleCycle(opts?: {
  force?: boolean;
}): Promise<VeilleRunResult> {
  const force = Boolean(opts?.force);
  const chatId = adminChatId();
  const notify = chatId
    ? telegramNotifier(chatId)
    : async (t: string) => {
        console.log("[veille]", t);
      };

  if (!(await isVeilleEnabled())) {
    return {
      ok: false,
      message: "Veille désactivée. Telegram : /veille_on pour réactiver.",
    };
  }

  if (!chatId) {
    return {
      ok: false,
      message:
        "Pas de chat Telegram admin (TELEGRAM_NOTIFY_CHAT_ID / ALLOWED_USER_IDS) — validation impossible.",
    };
  }

  const slot = currentVeilleSlot();
  if (!force) {
    if (!slot.inSlot) {
      return {
        ok: false,
        message: `Hors créneau (heure Paris ${slot.hour}h). Slots : 8/10/12/14/16/18/20.`,
        slotKey: slot.slotKey,
      };
    }
    const last = await getLastVeilleSlot();
    if (last === slot.slotKey) {
      return {
        ok: false,
        message: `Créneau ${slot.slotKey} déjà traité.`,
        slotKey: slot.slotKey,
      };
    }
  }

  const alreadyPending = await prisma.veilleItem.findFirst({
    where: { status: "pending_approval" },
    orderBy: { createdAt: "desc" },
  });
  if (alreadyPending && !force) {
    await notify(
      "⏳ Une créative attend déjà ta validation (/veille_ok ou /veille_non).",
    );
    return {
      ok: false,
      message: "Créative déjà en attente de validation.",
      pendingId: alreadyPending.id,
      slotKey: slot.slotKey,
    };
  }

  await notify(
    `🛰️ Veille ${slot.dateKey} ${String(slot.hour).padStart(2, "0")}h : scan…`,
  );

  const hits = await scrapeHotNews();
  if (hits.length === 0) {
    return {
      ok: false,
      message: "Aucune brève fraîche (<36h) récupérée.",
      slotKey: slot.slotKey,
    };
  }

  const picked = await scoreAndPickStory(hits);
  if (!picked) {
    await notify("Veille : rien d'assez engageant / frais ce tour-ci.");
    return {
      ok: false,
      message: "Aucun sujet au-dessus du seuil.",
      slotKey: slot.slotKey,
    };
  }

  const key = headlineKey(picked.canvaTitle || picked.sourceTitle);
  const existing = await prisma.veilleItem.findUnique({
    where: { headlineKey: key },
  });
  if (
    existing &&
    (existing.status === "published" || existing.status === "pending_approval")
  ) {
    await notify(
      existing.status === "pending_approval"
        ? "Veille : ce sujet attend déjà ta validation."
        : "Veille : sujet déjà publié, skip.",
    );
    return {
      ok: false,
      message:
        existing.status === "pending_approval"
          ? "Doublon (en attente)."
          : "Doublon (déjà publié).",
      slotKey: slot.slotKey,
    };
  }

  const item = await prisma.veilleItem.upsert({
    where: { headlineKey: key },
    create: {
      headline: picked.sourceTitle,
      headlineKey: key,
      sourceUrl: picked.sourceUrl,
      sourceTitle: picked.sourceTitle,
      score: picked.score,
      canvaTitle: picked.canvaTitle,
      highlightWords: picked.highlightWords,
      status: "found",
      slotKey: slot.slotKey,
    },
    update: {
      score: picked.score,
      canvaTitle: picked.canvaTitle,
      highlightWords: picked.highlightWords,
      sourceUrl: picked.sourceUrl,
      status: "found",
      slotKey: slot.slotKey,
      errorMessage: null,
    },
  });

  await notify(
    `Veille : sujet retenu (score ${picked.score})\n${picked.canvaTitle}\nVisuel: ${picked.visualQuery}`,
  );

  try {
    await notify("Veille : montage de la créative…");
    const bg = await fetchCreativeBackground({
      title: picked.canvaTitle,
      visualQuery: picked.visualQuery,
    });
    const png = await renderRempartCreative({
      background: bg.buffer,
      title: picked.canvaTitle,
      highlightWords: picked.highlightWords,
    });

    await prisma.veilleItem.update({
      where: { id: item.id },
      data: {
        status: "pending_approval",
        creativeImageMime: "image/png",
        creativeImageData: new Uint8Array(png),
        slotKey: slot.slotKey,
      },
    });

    const caption = [
      "🛑 VALIDATION REQUISE",
      "",
      picked.canvaTitle.slice(0, 280),
      "",
      `Score ${picked.score}`,
      "",
      "✅ /veille_ok — publier (site + Facebook)",
      "❌ /veille_non — refuser (rien n'est posté)",
      "",
      "Ou utilise les boutons ci-dessous.",
    ].join("\n");

    await telegramSendPhoto(chatId, png, caption, {
      replyMarkup: veilleApprovalKeyboard(item.id),
    });

    return {
      ok: true,
      message: "En attente de validation Telegram",
      score: picked.score,
      slotKey: slot.slotKey,
      pendingId: item.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "échec veille";
    console.error("veille cycle failed", err);
    await prisma.veilleItem.update({
      where: { id: item.id },
      data: { status: "failed", errorMessage: msg.slice(0, 500) },
    });
    await notify(`❌ Veille : échec\n${msg}`);
    return { ok: false, message: msg, slotKey: slot.slotKey };
  }
}

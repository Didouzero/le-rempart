import {
  fetchCreativeBackground,
  renderRempartCreative,
} from "@/lib/creative";
import { prisma } from "@/lib/prisma";
import {
  publishCreativePipeline,
  telegramNotifier,
} from "@/lib/publish-pipeline";
import {
  getAllowedTelegramUserIds,
  telegramSendPhoto,
} from "@/lib/telegram";
import { headlineKey, scrapeHotNews } from "@/lib/veille/scrape";
import { scoreAndPickStory } from "@/lib/veille/score";
import { isVeilleEnabled } from "@/lib/veille/settings";

export type VeilleRunResult = {
  ok: boolean;
  message: string;
  articleUrl?: string;
  score?: number;
};

function adminChatId(): number | null {
  const fromEnv = process.env.TELEGRAM_NOTIFY_CHAT_ID?.trim();
  if (fromEnv && Number.isFinite(Number(fromEnv))) return Number(fromEnv);
  const allowed = getAllowedTelegramUserIds();
  return allowed[0] ?? null;
}

/**
 * Un cycle de veille : scrape → score → créative → publish site+FB.
 */
export async function runVeilleCycle(): Promise<VeilleRunResult> {
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

  await notify("🛰️ Veille : scan des news…");

  const hits = await scrapeHotNews();
  if (hits.length === 0) {
    return { ok: false, message: "Aucune brève RSS récupérée." };
  }

  const picked = await scoreAndPickStory(hits);
  if (!picked) {
    await notify("Veille : rien d'assez engageant ce tour-ci.");
    return { ok: false, message: "Aucun sujet au-dessus du seuil." };
  }

  const key = headlineKey(picked.canvaTitle || picked.sourceTitle);
  const existing = await prisma.veilleItem.findUnique({
    where: { headlineKey: key },
  });
  if (existing && existing.status === "published") {
    await notify("Veille : sujet déjà publié, skip.");
    return { ok: false, message: "Doublon (déjà publié)." };
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
    },
    update: {
      score: picked.score,
      canvaTitle: picked.canvaTitle,
      highlightWords: picked.highlightWords,
      sourceUrl: picked.sourceUrl,
      status: "found",
      errorMessage: null,
    },
  });

  await notify(
    `Veille : sujet retenu (score ${picked.score})\n${picked.canvaTitle}`,
  );

  try {
    await notify("Veille : montage de la créative…");
    const bg = await fetchCreativeBackground({ title: picked.canvaTitle });
    const png = await renderRempartCreative({
      background: bg.buffer,
      title: picked.canvaTitle,
      highlightWords: picked.highlightWords,
    });

    if (chatId) {
      await telegramSendPhoto(
        chatId,
        png,
        `Créative auto\n${picked.canvaTitle.slice(0, 200)}`,
      );
    }

    const result = await publishCreativePipeline({
      caption: picked.canvaTitle,
      image: { buffer: png, mime: "image/png" },
      notify,
    });

    await prisma.veilleItem.update({
      where: { id: item.id },
      data: {
        status: "published",
        articleId: result.article.id,
      },
    });

    return {
      ok: true,
      message: "Publié",
      articleUrl: result.article.url,
      score: picked.score,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "échec veille";
    console.error("veille cycle failed", err);
    await prisma.veilleItem.update({
      where: { id: item.id },
      data: { status: "failed", errorMessage: msg.slice(0, 500) },
    });
    await notify(`❌ Veille : échec\n${msg}`);
    return { ok: false, message: msg };
  }
}

import { telegramSendMessage } from "@/lib/telegram";
import { formatDuration } from "@/lib/tiktok/types";

export function tiktokPreviewKeyboard(jobId: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Poster", callback_data: `tt:ok:${jobId}` },
        { text: "🔄 Refaire", callback_data: `tt:redo:${jobId}` },
        { text: "❌ Annuler", callback_data: `tt:no:${jobId}` },
      ],
    ],
  };
}

export async function telegramSendVideoFromUrl(
  chatId: number,
  videoUrl: string,
  caption: string,
  replyMarkup?: Record<string, unknown>,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption: caption.slice(0, 1000),
      supports_streaming: true,
      reply_markup: replyMarkup,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    console.error("telegramSendVideoFromUrl failed", data.description || res.status);
    return false;
  }
  return true;
}

export async function sendTiktokPreview(input: {
  chatId: number;
  jobId: string;
  title: string;
  caption: string;
  durationMs: number;
  renderUrl: string;
}): Promise<void> {
  const text = [
    `Droitocratie — aperçu ${formatDuration(input.durationMs)}`,
    input.title,
    "",
    "Caption TikTok :",
    input.caption.slice(0, 700),
    "",
    "/tiktok_ok pour poster · /tiktok_cancel pour jeter",
  ].join("\n");

  const markup = tiktokPreviewKeyboard(input.jobId);
  const sent = await telegramSendVideoFromUrl(
    input.chatId,
    input.renderUrl,
    text,
    markup,
  );
  if (!sent) {
    await telegramSendMessage(input.chatId, `${text}\n\nVidéo : ${input.renderUrl}`, {
      reply_markup: markup,
    });
  }
}

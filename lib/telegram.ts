const TELEGRAM_API = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

export function getAllowedTelegramUserIds(): number[] {
  const raw = process.env.TELEGRAM_ALLOWED_USER_IDS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

export function isTelegramUserAllowed(userId: number): boolean {
  const allowed = getAllowedTelegramUserIds();
  if (allowed.length === 0) return false;
  return allowed.includes(userId);
}

export async function telegramSendMessage(
  chatId: number,
  text: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const token = getToken();
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
      ...extra,
    }),
  });
}

export async function telegramGetFileUrl(fileId: string): Promise<string> {
  const token = getToken();
  const res = await fetch(
    `${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  const data = (await res.json()) as {
    ok: boolean;
    result?: { file_path?: string };
    description?: string;
  };
  if (!data.ok || !data.result?.file_path) {
    throw new Error(data.description || "Impossible de récupérer le fichier Telegram");
  }
  return `${TELEGRAM_API}/file/bot${token}/${data.result.file_path}`;
}

export async function telegramDownloadFile(
  fileId: string,
): Promise<{ buffer: Buffer; mime: string }> {
  const url = await telegramGetFileUrl(fileId);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Téléchargement image Telegram échoué");
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mime };
}

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    caption?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
    document?: {
      file_id: string;
      mime_type?: string;
      file_name?: string;
    };
  };
};

export function pickLargestPhoto(
  photos: Array<{ file_id: string; width: number; height: number }>,
): string {
  const sorted = [...photos].sort((a, b) => b.width * b.height - a.width * a.height);
  return sorted[0].file_id;
}

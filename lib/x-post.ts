const UPLOAD_POST_URL = "https://api.upload-post.com/api/upload_photos";

// UPLOAD_POST_USER désigne le profil de @spittinbot : le Rempart a le sien.
function getConfig(): { apiKey: string; user: string } | null {
  const apiKey = process.env.UPLOAD_POST_API_KEY?.trim();
  const user = process.env.UPLOAD_POST_X_USER?.trim() || "Le_Rempart";
  if (!apiKey) return null;
  return { apiKey, user };
}

export function isXConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Publie la créative et le flash sur X via upload-post.
 * Upload-post retire tout lien des posts X : le flash part donc sans l'adresse de l'article.
 * Un flash trop long devient un fil, sauf UPLOAD_POST_X_LONG_POST=1 (compte X Premium).
 */
async function publishXPost(input: {
  text: string;
  image: { buffer: Buffer; mime: string };
}): Promise<string | undefined> {
  const config = getConfig();
  if (!config) throw new Error("X non configuré (UPLOAD_POST_API_KEY)");

  const form = new FormData();
  form.append("user", config.user);
  form.append("platform[]", "x");
  form.append("title", input.text);
  if (process.env.UPLOAD_POST_X_LONG_POST === "1") {
    form.append("x_long_text_as_post", "true");
  }
  const ext = input.image.mime.includes("png") ? "png" : "jpg";
  form.append(
    "photos[]",
    new Blob([new Uint8Array(input.image.buffer)], {
      type: input.image.mime || "image/jpeg",
    }),
    `creative.${ext}`,
  );

  const res = await fetch(UPLOAD_POST_URL, {
    method: "POST",
    headers: { Authorization: `Apikey ${config.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    error?: string;
    request_id?: string;
    results?: { x?: { success?: boolean; url?: string; error?: string } };
  };
  const x = data.results?.x;
  if (!res.ok || data.success === false || x?.success === false) {
    throw new Error(x?.error || data.error || data.message || `upload-post ${res.status}`);
  }
  return x?.url;
}

/** Post X best effort : un échec est signalé sur Telegram sans bloquer le reste. */
export async function publishXForPost(input: {
  text: string;
  image?: { buffer: Buffer; mime: string };
  notify: (text: string) => Promise<void>;
}): Promise<void> {
  if (!isXConfigured() || !input.image?.buffer.length) return;
  await input.notify("X : publication du post…");
  try {
    const url = await publishXPost({ text: input.text, image: input.image });
    await input.notify(url ? `✅ Post X publié.\n${url}` : "✅ Post X envoyé (traitement en cours chez upload-post).");
  } catch (err) {
    console.error("x post", err);
    await input.notify(`❌ Post X : échec\n${err instanceof Error ? err.message : "erreur"}`);
  }
}

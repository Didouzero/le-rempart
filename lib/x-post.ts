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
 * Le compte est Premium : le flash part en un seul post, identique à la légende Facebook.
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
  form.append("x_long_text_as_post", "true");
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

/**
 * Adresse écrite « le-rempart[.]org/articles/12 » : X n'en fait pas un lien,
 * donc upload-post la laisse. Placée juste avant la ligne des sources.
 */
export function withPlainLink(flash: string, label: string, url: string): string {
  const plain = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\./g, "[.]");
  const line = `${label} : ${plain}`;
  const at = flash.lastIndexOf("\n\n(Source");
  return at === -1 ? `${flash}\n\n${line}` : `${flash.slice(0, at)}\n\n${line}${flash.slice(at)}`;
}

/** Post X best effort : un échec est signalé sur Telegram sans bloquer le reste. */
export async function publishXForPost(input: {
  text: string;
  image?: { buffer: Buffer; mime: string };
  /** Adresse de l'article ou de l'enquête, écrite sans lien avant les sources. */
  link?: { label: string; url: string };
  notify: (text: string) => Promise<void>;
}): Promise<void> {
  if (!isXConfigured() || !input.image?.buffer.length) return;
  await input.notify("X : publication du post…");
  const text = input.link
    ? withPlainLink(input.text, input.link.label, input.link.url)
    : input.text;
  try {
    const url = await publishXPost({ text, image: input.image });
    await input.notify(url ? `✅ Post X publié.\n${url}` : "✅ Post X envoyé (traitement en cours chez upload-post).");
  } catch (err) {
    console.error("x post", err);
    await input.notify(`❌ Post X : échec\n${err instanceof Error ? err.message : "erreur"}`);
  }
}

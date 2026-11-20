import { prepareStoryImage } from "@/lib/creative/story";

const UPLOAD_POST_URL ="https://api.upload-post.com/api/upload_photos";

type Image = { buffer: Buffer; mime: string };
type Notify = (text: string) => Promise<void>;

// UPLOAD_POST_USER désigne le profil de @spittinbot : le Rempart a le sien.
// X et Instagram sont reliés au même profil upload-post, sauf réglage contraire.
function getConfig(): { apiKey: string; xUser: string; igUser: string } | null {
  const apiKey = process.env.UPLOAD_POST_API_KEY?.trim();
  const xUser = process.env.UPLOAD_POST_X_USER?.trim() || "Le_Rempart";
  const igUser = process.env.UPLOAD_POST_INSTAGRAM_USER?.trim() || xUser;
  if (!apiKey) return null;
  return { apiKey, xUser, igUser };
}

export function isXConfigured(): boolean {
  return getConfig() !== null;
}

function isInstagramEnabled(): boolean {
  return process.env.UPLOAD_POST_INSTAGRAM_DISABLED?.trim() !== "1";
}

type PlatformResult = { success?: boolean; url?: string; error?: string };

/** Envoie une image à upload-post pour une plateforme ; renvoie l'URL du post si connue. */
async function uploadPhoto(input: {
  platform: "x" | "instagram";
  user: string;
  apiKey: string;
  image: Image;
  fields: Record<string, string>;
}): Promise<string | undefined> {
  const form = new FormData();
  form.append("user", input.user);
  form.append("platform[]", input.platform);
  for (const [k, v] of Object.entries(input.fields)) form.append(k, v);
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
    headers: { Authorization: `Apikey ${input.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    error?: string;
    results?: Record<string, PlatformResult | undefined>;
  };
  const r = data.results?.[input.platform];
  if (!res.ok || data.success === false || r?.success === false) {
    throw new Error(r?.error || data.error || data.message || `upload-post ${res.status}`);
  }
  return r?.url;
}

/**
 * Upload-post retire tout lien des posts X : le flash part donc sans l'adresse de l'article.
 * Le compte est Premium : le flash part en un seul post, identique à la légende Facebook.
 */
async function publishX(text: string, image: Image): Promise<string | undefined> {
  const config = getConfig();
  if (!config) throw new Error("X non configuré (UPLOAD_POST_API_KEY)");
  return uploadPhoto({
    platform: "x",
    user: config.xUser,
    apiKey: config.apiKey,
    image,
    fields: { title: text, x_long_text_as_post: "true" },
  });
}

/** Instagram : post du fil (légende = flash) ou story (image seule). */
async function publishInstagram(
  kind: "IMAGE" | "STORIES",
  text: string,
  image: Image,
): Promise<string | undefined> {
  const config = getConfig();
  if (!config) throw new Error("Instagram non configuré (UPLOAD_POST_API_KEY)");
  const fields: Record<string, string> =
    kind === "IMAGE"
      ? { title: text.slice(0, 2200), instagram_title: text.slice(0, 2200), media_type: "IMAGE" }
      : { title: text.slice(0, 2200), media_type: "STORIES" };
  return uploadPhoto({
    platform: "instagram",
    user: config.igUser,
    apiKey: config.apiKey,
    image,
    fields,
  });
}

async function attempt(
  label: string,
  notify: Notify,
  run: () => Promise<string | undefined>,
): Promise<void> {
  try {
    const url = await run();
    await notify(url ? `✅ ${label} publié.\n${url}` : `✅ ${label} envoyé (traitement en cours chez upload-post).`);
  } catch (err) {
    console.error(label, err);
    await notify(`❌ ${label} : échec\n${err instanceof Error ? err.message : "erreur"}`);
  }
}

/**
 * Réseaux via upload-post, best effort : post X, post Instagram et story Instagram,
 * avec le même flash que Facebook. Un échec est signalé sur Telegram sans bloquer le reste.
 */
export async function publishXForPost(input: {
  text: string;
  image?: Image;
  notify: Notify;
}): Promise<void> {
  if (!isXConfigured() || !input.image?.buffer.length) return;
  const image = input.image;
  await input.notify(
    isInstagramEnabled()
      ? "X + Instagram : publication du post et de la story…"
      : "X : publication du post…",
  );
  await attempt("Post X", input.notify, () => publishX(input.text, image));
  if (!isInstagramEnabled()) return;
  await attempt("Post Instagram", input.notify, () => publishInstagram("IMAGE", input.text, image));
  await attempt("Story Instagram", input.notify, async () =>
    publishInstagram("STORIES", input.text, await prepareStoryImage(image)),
  );
}

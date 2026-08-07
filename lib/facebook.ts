const GRAPH = "https://graph.facebook.com/v21.0";

function getPageConfig(): { pageId: string; token: string } | null {
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  if (!pageId || !token) return null;
  return { pageId, token };
}

export function isFacebookConfigured(): boolean {
  return getPageConfig() !== null;
}

type GraphError = {
  error?: {
    message?: string;
    code?: number;
    type?: string;
    error_subcode?: number;
  };
};

export class FacebookGraphError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, code?: number, subcode?: number) {
    super(message);
    this.name = "FacebookGraphError";
    this.code = code;
    this.subcode = subcode;
  }
}

/** Message Telegram avec code Graph (ex. 368 / subcode 1390008). */
export function formatFacebookError(err: unknown): string {
  if (err instanceof FacebookGraphError) {
    const bits = [err.message];
    if (err.code != null) bits.push(`code=${err.code}`);
    if (err.subcode != null) bits.push(`subcode=${err.subcode}`);
    return bits.join(" | ");
  }
  return err instanceof Error ? err.message : String(err);
}

/** Blocage anti-spam / rate-limit : ne pas enchaîner d'autres tentatives. */
export function isFacebookActionBlocked(err: unknown): boolean {
  const code = err instanceof FacebookGraphError ? err.code : undefined;
  if (
    code === 368 || // temporarily blocked for policies / "going too fast"
    code === 32 || // page rate limit
    code === 4 || // app rate limit
    code === 17 || // user request limit
    code === 613 || // custom rate limit
    code === 80001 ||
    code === 80002
  ) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /protéger la communauté|protect the community|limiting how often|rate limit|spam|try again later|réessayer plus tard|temporarily blocked|action is blocked|user limit|limitons le nombre|going too fast|misusing this feature/i.test(
    msg,
  );
}

async function graphJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(22_000),
  });
  const data = (await res.json()) as T & GraphError;
  if (!res.ok || data.error) {
    throw new FacebookGraphError(
      data.error?.message || `Facebook Graph error ${res.status}`,
      data.error?.code,
      data.error?.error_subcode,
    );
  }
  return data;
}

/**
 * Convertit le token Vercel (souvent System User) en vrai Page Access Token.
 * Poster avec un System User token brut déclenche l'erreur deprecated publish_actions.
 */
async function resolvePagePublishToken(): Promise<{
  pageId: string;
  pageName: string;
  token: string;
}> {
  const config = getPageConfig();
  if (!config) throw new Error("Facebook non configuré");

  const page = await graphJson<{
    id: string;
    name: string;
    access_token?: string;
  }>(
    `${GRAPH}/${config.pageId}?fields=id,name,access_token&access_token=${encodeURIComponent(config.token)}`,
  );

  const pageToken = page.access_token || config.token;

  const me = await graphJson<{ id: string; name?: string }>(
    `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(pageToken)}`,
  );

  if (me.id !== config.pageId && !page.access_token) {
    throw new Error(
      `Impossible d'obtenir un Page Access Token (me=${me.id}, page=${config.pageId}). Régénère le token système avec pages_manage_posts + Page affectée.`,
    );
  }

  return {
    pageId: page.id,
    pageName: page.name,
    token: page.access_token || pageToken,
  };
}

export async function assertFacebookPageToken(): Promise<{
  id: string;
  name: string;
}> {
  const page = await resolvePagePublishToken();
  return { id: page.pageId, name: page.pageName };
}

async function uploadUnpublishedPhoto(input: {
  pageId: string;
  token: string;
  imageUrl?: string;
  image?: { buffer: Buffer; mime: string };
}): Promise<string> {
  if (input.image) {
    const form = new FormData();
    const ext = input.image.mime.includes("png") ? "png" : "jpg";
    form.append(
      "source",
      new Blob([new Uint8Array(input.image.buffer)], {
        type: input.image.mime || "image/jpeg",
      }),
      `creative.${ext}`,
    );
    form.append("published", "false");
    form.append("access_token", input.token);

    const photo = await graphJson<{ id: string }>(
      `${GRAPH}/${input.pageId}/photos`,
      { method: "POST", body: form },
    );
    return photo.id;
  }

  if (input.imageUrl) {
    const photo = await graphJson<{ id: string }>(
      `${GRAPH}/${input.pageId}/photos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          url: input.imageUrl,
          published: "false",
          access_token: input.token,
        }),
      },
    );
    return photo.id;
  }

  throw new Error("Aucune image pour upload Facebook");
}

async function publishPhotoStory(input: {
  pageId: string;
  token: string;
  photoId: string;
}): Promise<string> {
  const story = await graphJson<{ success?: boolean; post_id?: string }>(
    `${GRAPH}/${input.pageId}/photo_stories`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        photo_id: input.photoId,
        access_token: input.token,
      }),
    },
  );
  if (!story.success && !story.post_id) {
    throw new Error("Story Facebook refusée");
  }
  return story.post_id || input.photoId;
}

/** Story = upload photo inédite + photo_stories (1 tentative, pas de retry spam). */
async function publishCreativeAsStory(input: {
  pageId: string;
  token: string;
  imageUrl: string;
  image?: { buffer: Buffer; mime: string };
}): Promise<string> {
  const storyPhotoId = await uploadUnpublishedPhoto({
    pageId: input.pageId,
    token: input.token,
    image: input.image,
    imageUrl: input.image ? undefined : input.imageUrl,
  });
  return publishPhotoStory({
    pageId: input.pageId,
    token: input.token,
    photoId: storyPhotoId,
  });
}

async function commentAndPin(
  postId: string,
  link: string,
  token: string,
): Promise<{ commentId: string; pinned: boolean; pinError?: string }> {
  const comment = await graphJson<{ id: string }>(
    `${GRAPH}/${postId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: `➡️ ${link}`,
        access_token: token,
      }),
    },
  );

  // Pin désactivé par défaut : +1/2 appels Graph qui aggravent le code 368.
  // Opt-in : FACEBOOK_PIN_COMMENT=true
  const pinOn =
    process.env.FACEBOOK_PIN_COMMENT?.trim().toLowerCase() === "true" ||
    process.env.FACEBOOK_PIN_COMMENT?.trim() === "1";
  if (!pinOn) {
    return { commentId: comment.id, pinned: false };
  }

  try {
    await graphJson(`${GRAPH}/${comment.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        is_pinned: "true",
        access_token: token,
      }),
    });
    return { commentId: comment.id, pinned: true };
  } catch (err) {
    if (isFacebookActionBlocked(err)) throw err;
    console.error("Facebook pin failed", err);
    return {
      commentId: comment.id,
      pinned: false,
      pinError: formatFacebookError(err),
    };
  }
}

/** Lien article en 1er commentaire (meilleur pour le reach que dans la légende). */
export async function commentArticleLinkOnPost(input: {
  postId: string;
  articleUrl: string;
  token: string;
}): Promise<{ commentId: string; pinned: boolean; pinError?: string }> {
  const url = input.articleUrl.replace(
    "://le-rempart.org",
    "://www.le-rempart.org",
  );
  return commentAndPin(input.postId, url, input.token);
}

async function publishFeedWithPhoto(input: {
  pageId: string;
  token: string;
  caption: string;
  photoId: string;
}): Promise<string> {
  const feed = await graphJson<{ id: string }>(
    `${GRAPH}/${input.pageId}/feed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: input.caption,
        attached_media: JSON.stringify([{ media_fbid: input.photoId }]),
        access_token: input.token,
      }),
    },
  );
  return feed.id;
}

/**
 * Publie le post Page (créative + caption) en UN seul appel Graph.
 * Pas de cascade multi-méthodes : chaque retry compte pour l'anti-spam Meta (code 368).
 */
export async function publishFacebookFeedPost(input: {
  imageUrl: string;
  caption: string;
  commentLink: string;
  image?: { buffer: Buffer; mime: string };
}): Promise<{ postId: string; pageId: string; token: string }> {
  const page = await resolvePagePublishToken();
  const { prepareFacebookImage } = await import("@/lib/fb-image");

  if (input.image) {
    const prepared = await prepareFacebookImage(input.image);
    const form = new FormData();
    form.append(
      "source",
      new Blob([new Uint8Array(prepared.buffer)], {
        type: prepared.mime || "image/jpeg",
      }),
      "creative.jpg",
    );
    form.append("caption", input.caption);
    form.append("published", "true");
    form.append("access_token", page.token);

    const photo = await graphJson<{ id: string; post_id?: string }>(
      `${GRAPH}/${page.pageId}/photos`,
      { method: "POST", body: form },
    );
    return {
      postId: photo.post_id || `${page.pageId}_${photo.id}`,
      pageId: page.pageId,
      token: page.token,
    };
  }

  // Fallback image absente : URL → unpublished + feed (2 appels max)
  const photoId = await uploadUnpublishedPhoto({
    pageId: page.pageId,
    token: page.token,
    imageUrl: input.imageUrl,
  });
  const postId = await publishFeedWithPhoto({
    pageId: page.pageId,
    token: page.token,
    caption: input.caption,
    photoId,
  });
  return { postId, pageId: page.pageId, token: page.token };
}

/**
 * Publie la créative en Story Page (photo inédite + retries).
 */
export async function publishFacebookStory(input: {
  imageUrl: string;
  image?: { buffer: Buffer; mime: string };
  pageId?: string;
  token?: string;
}): Promise<string> {
  const page =
    input.pageId && input.token
      ? { pageId: input.pageId, token: input.token }
      : await resolvePagePublishToken().then((p) => ({
          pageId: p.pageId,
          token: p.token,
        }));

  return publishCreativeAsStory({
    pageId: page.pageId,
    token: page.token,
    imageUrl: input.imageUrl,
    image: input.image
      ? await (await import("@/lib/fb-image")).prepareFacebookImage(input.image)
      : undefined,
  });
}

/**
 * Publie la créative : post Page + Story.
 * Préférer publishFacebookFeedPost + publishFacebookStory pour notifier entre les deux.
 */
export async function postCreativeToFacebookPage(input: {
  imageUrl: string;
  caption: string;
  commentLink: string;
  image?: { buffer: Buffer; mime: string };
}): Promise<{
  postId: string;
  commentId: string;
  pinned: boolean;
  storyId: string | null;
  storyError?: string;
}> {
  const feed = await publishFacebookFeedPost(input);

  let storyId: string | null = null;
  let storyError: string | undefined;
  try {
    storyId = await publishFacebookStory({
      imageUrl: input.imageUrl,
      image: input.image,
      pageId: feed.pageId,
      token: feed.token,
    });
  } catch (err) {
    console.error("FB story failed after retries", err);
    storyError = err instanceof Error ? err.message : "story failed";
  }

  return {
    postId: feed.postId,
    commentId: "",
    pinned: false,
    storyId,
    storyError,
  };
}

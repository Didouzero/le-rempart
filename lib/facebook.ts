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
  error?: { message?: string; code?: number; type?: string };
};

async function graphJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & GraphError;
  if (!res.ok || data.error) {
    throw new Error(
      data.error?.message || `Facebook Graph error ${res.status}`,
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
        message: link,
        attachment_url: link,
        access_token: token,
      }),
    },
  );

  const pinAttempts = [
    async () => {
      await graphJson(`${GRAPH}/${comment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          is_pinned: "true",
          access_token: token,
        }),
      });
    },
    async () => {
      await graphJson(
        `https://graph.facebook.com/v18.0/${comment.id}?is_pinned=true&access_token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
    },
  ];

  let lastPinError: string | undefined;
  for (const attempt of pinAttempts) {
    try {
      await attempt();
      return { commentId: comment.id, pinned: true };
    } catch (err) {
      console.error("Facebook pin attempt failed", err);
      lastPinError = err instanceof Error ? err.message : "pin failed";
    }
  }

  return {
    commentId: comment.id,
    pinned: false,
    pinError: lastPinError,
  };
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
 * Publie la créative : post Page + Story + commentaire lien.
 * Meta exige une photo inédite pour la Story (2e upload).
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
  const page = await resolvePagePublishToken();

  let postId: string | null = null;
  let lastErr: unknown;

  // 1) Upload photo unpublished (multipart) → feed
  if (input.image && !postId) {
    try {
      const photoId = await uploadUnpublishedPhoto({
        pageId: page.pageId,
        token: page.token,
        image: input.image,
      });
      postId = await publishFeedWithPhoto({
        pageId: page.pageId,
        token: page.token,
        caption: input.caption,
        photoId,
      });
    } catch (err) {
      lastErr = err;
      console.error("FB multipart unpublished+feed failed", err);
    }
  }

  // 2) Upload photo unpublished (URL) → feed
  if (!postId) {
    try {
      const photoId = await uploadUnpublishedPhoto({
        pageId: page.pageId,
        token: page.token,
        imageUrl: input.imageUrl,
      });
      postId = await publishFeedWithPhoto({
        pageId: page.pageId,
        token: page.token,
        caption: input.caption,
        photoId,
      });
    } catch (err) {
      lastErr = err;
      console.error("FB url unpublished+feed failed", err);
    }
  }

  // 3) Photo publiée directement
  if (!postId && input.image) {
    try {
      const form = new FormData();
      const ext = input.image.mime.includes("png") ? "png" : "jpg";
      form.append(
        "source",
        new Blob([new Uint8Array(input.image.buffer)], {
          type: input.image.mime || "image/jpeg",
        }),
        `creative.${ext}`,
      );
      form.append("caption", input.caption);
      form.append("published", "true");
      form.append("access_token", page.token);

      const photo = await graphJson<{ id: string; post_id?: string }>(
        `${GRAPH}/${page.pageId}/photos`,
        { method: "POST", body: form },
      );
      postId = photo.post_id || `${page.pageId}_${photo.id}`;
    } catch (err) {
      lastErr = err;
      console.error("FB multipart published failed", err);
    }
  }

  // 4) Texte + lien
  if (!postId) {
    try {
      const feed = await graphJson<{ id: string }>(
        `${GRAPH}/${page.pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            message: input.caption,
            link: input.commentLink,
            access_token: page.token,
          }),
        },
      );
      postId = feed.id;
    } catch (err) {
      throw lastErr instanceof Error
        ? lastErr
        : err instanceof Error
          ? err
          : new Error("Publication Facebook impossible");
    }
  }

  // Story : nouvel upload obligatoire (photo déjà utilisée pour le feed = refusée)
  let storyId: string | null = null;
  let storyError: string | undefined;
  try {
    const storyPhotoId = await uploadUnpublishedPhoto({
      pageId: page.pageId,
      token: page.token,
      image: input.image,
      imageUrl: input.image ? undefined : input.imageUrl,
    });
    storyId = await publishPhotoStory({
      pageId: page.pageId,
      token: page.token,
      photoId: storyPhotoId,
    });
  } catch (err) {
    console.error("FB story failed", err);
    storyError = err instanceof Error ? err.message : "story failed";
  }

  const { commentId, pinned } = await commentAndPin(
    postId,
    input.commentLink,
    page.token,
  );

  return { postId, commentId, pinned, storyId, storyError };
}

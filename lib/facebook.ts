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

async function graphJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & GraphError;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Facebook Graph error ${res.status}`);
  }
  return data;
}

/**
 * Publie la créative sur la Page, avec caption FLASH INFO,
 * puis un commentaire épinglé contenant le lien article.
 */
export async function postCreativeToFacebookPage(input: {
  image: { buffer: Buffer; mime: string };
  caption: string;
  commentLink: string;
}): Promise<{ postId: string; commentId: string }> {
  const config = getPageConfig();
  if (!config) {
    throw new Error("Facebook non configuré (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN)");
  }

  const form = new FormData();
  const ext = input.image.mime.includes("png") ? "png" : "jpg";
  form.append(
    "source",
    new Blob([new Uint8Array(input.image.buffer)], { type: input.image.mime }),
    `creative.${ext}`,
  );
  form.append("caption", input.caption);
  form.append("access_token", config.token);
  form.append("published", "true");

  const photo = await graphJson<{ id: string; post_id?: string }>(
    `${GRAPH}/${config.pageId}/photos`,
    { method: "POST", body: form },
  );

  const photoId = photo.id;
  const postId = photo.post_id || photo.id;

  const comment = await graphJson<{ id: string }>(
    `${GRAPH}/${photoId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: input.commentLink,
        access_token: config.token,
      }),
    },
  );

  try {
    await graphJson(`${GRAPH}/${comment.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        is_pinned: "true",
        access_token: config.token,
      }),
    });
  } catch (err) {
    // Pin peut échouer selon permissions ; le commentaire reste publié
    console.error("Facebook pin comment failed", err);
  }

  return { postId, commentId: comment.id };
}

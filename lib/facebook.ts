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
 * Vérifie que le token peut agir sur FACEBOOK_PAGE_ID.
 * Accepte token Page OU token utilisateur système (Business Manager).
 */
export async function assertFacebookPageToken(): Promise<{
  id: string;
  name: string;
}> {
  const config = getPageConfig();
  if (!config) throw new Error("Facebook non configuré");

  // Test réel : accès à la Page configurée (valide Page token et System User token)
  try {
    const page = await graphJson<{ id: string; name: string }>(
      `${GRAPH}/${config.pageId}?fields=id,name&access_token=${encodeURIComponent(config.token)}`,
    );
    return page;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "accès refusé";
    throw new Error(
      `Token OK mais pas d'accès à la Page ${config.pageId} : ${detail}. Affecte la Page Le Rempart à l'utilisateur système.`,
    );
  }
}

async function commentAndPin(postId: string, link: string, token: string) {
  const comment = await graphJson<{ id: string }>(
    `${GRAPH}/${postId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: link,
        access_token: token,
      }),
    },
  );

  try {
    await graphJson(`${GRAPH}/${comment.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        is_pinned: "true",
        access_token: token,
      }),
    });
  } catch (err) {
    console.error("Facebook pin failed", err);
  }

  return comment.id;
}

/**
 * Publie la créative sur la Page.
 * 1) Essai via URL publique
 * 2) Fallback upload binaire (multipart) si l'URL échoue
 */
export async function postCreativeToFacebookPage(input: {
  imageUrl: string;
  caption: string;
  commentLink: string;
  image?: { buffer: Buffer; mime: string };
}): Promise<{ postId: string; commentId: string }> {
  const config = getPageConfig();
  if (!config) {
    throw new Error("Facebook non configuré");
  }

  await assertFacebookPageToken();

  let postId: string | null = null;
  let lastErr: unknown;

  // Méthode A : photo publiée directement avec URL
  try {
    const params = new URLSearchParams({
      url: input.imageUrl,
      caption: input.caption,
      published: "true",
      access_token: config.token,
    });
    const photo = await graphJson<{ id: string; post_id?: string }>(
      `${GRAPH}/${config.pageId}/photos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      },
    );
    postId = photo.post_id || `${config.pageId}_${photo.id}`;
  } catch (err) {
    lastErr = err;
    console.error("FB url photo failed", err);
  }

  // Méthode B : multipart avec le buffer
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
      form.append("access_token", config.token);

      const photo = await graphJson<{ id: string; post_id?: string }>(
        `${GRAPH}/${config.pageId}/photos`,
        { method: "POST", body: form },
      );
      postId = photo.post_id || `${config.pageId}_${photo.id}`;
    } catch (err) {
      lastErr = err;
      console.error("FB multipart photo failed", err);
    }
  }

  // Méthode C : post texte + lien (dernier recours)
  if (!postId) {
    try {
      const feed = await graphJson<{ id: string }>(
        `${GRAPH}/${config.pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            message: input.caption,
            link: input.commentLink,
            access_token: config.token,
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

  const commentId = await commentAndPin(
    postId,
    input.commentLink,
    config.token,
  );
  return { postId, commentId };
}

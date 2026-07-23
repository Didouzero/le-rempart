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
  error?: { message?: string; code?: number; type?: string; error_subcode?: number };
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
 * Vérifie que le token est bien un Page token (pas un token profil perso).
 */
export async function assertFacebookPageToken(): Promise<{ id: string; name: string }> {
  const config = getPageConfig();
  if (!config) throw new Error("Facebook non configuré");

  const me = await graphJson<{ id: string; name: string }>(
    `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(config.token)}`,
  );

  if (me.id !== config.pageId) {
    throw new Error(
      `Le token ne correspond pas à FACEBOOK_PAGE_ID (token→${me.id}, env→${config.pageId}). Régénère un « token d'accès de Page ».`,
    );
  }

  return me;
}

/**
 * Publie la créative sur la Page via URL publique (API Pages moderne).
 * Évite multipart / publish_actions déprécié.
 *
 * 1) upload photo unpublished via url
 * 2) post feed avec attached_media + caption FLASH INFO
 * 3) commentaire épinglé avec le lien article
 */
export async function postCreativeToFacebookPage(input: {
  /** URL publique HTTPS de la créative (ex. https://www.le-rempart.org/api/media/{id}) */
  imageUrl: string;
  caption: string;
  commentLink: string;
}): Promise<{ postId: string; commentId: string }> {
  const config = getPageConfig();
  if (!config) {
    throw new Error(
      "Facebook non configuré (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN)",
    );
  }

  await assertFacebookPageToken();

  // 1) Upload photo (non publiée seule) depuis URL
  const photoParams = new URLSearchParams({
    url: input.imageUrl,
    published: "false",
    access_token: config.token,
  });
  const photo = await graphJson<{ id: string }>(
    `${GRAPH}/${config.pageId}/photos`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: photoParams,
    },
  );

  // 2) Créer le post Page avec la photo attachée
  const feedParams = new URLSearchParams();
  feedParams.set("message", input.caption);
  feedParams.set("attached_media[0]", JSON.stringify({ media_fbid: photo.id }));
  feedParams.set("access_token", config.token);

  const feed = await graphJson<{ id: string }>(`${GRAPH}/${config.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: feedParams,
  });

  const postId = feed.id;

  // 3) Commentaire avec le lien
  const comment = await graphJson<{ id: string }>(
    `${GRAPH}/${postId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: input.commentLink,
        access_token: config.token,
      }),
    },
  );

  // 4) Épingler (best-effort)
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
    console.error("Facebook pin comment failed", err);
  }

  return { postId, commentId: comment.id };
}

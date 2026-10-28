export type ImageSize = { width: number; height: number };

/** Les illustrations fournies au bot font toujours 1600 × 900 (16:9). */
export const HOSTED_ILLUSTRATION_SIZE: ImageSize = { width: 1600, height: 900 };

/** Dimensions de la couverture si c'est l'illustration servie par /api/media/{id}/illustration. */
export function hostedIllustrationSize(
  coverUrl: string | null,
  articleId: string,
): ImageSize | null {
  return coverUrl?.includes(`/api/media/${articleId}/illustration`)
    ? HOSTED_ILLUSTRATION_SIZE
    : null;
}

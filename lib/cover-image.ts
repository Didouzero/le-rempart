/** Largeurs servies par /api/media/{id}/illustration?w= (WebP). */
export const ILLUSTRATION_WIDTHS = [480, 800, 1200, 1600] as const;

const HOSTED = /^(?:https?:\/\/[^/]+)?(\/api\/media\/[^/?#]+\/illustration)$/;

/**
 * src / srcSet d'une image de couverture. Les illustrations hébergées sont servies
 * en WebP à la bonne largeur ; les images externes restent telles quelles.
 */
export function coverSources(url: string): { src: string; srcSet?: string } {
  const hosted = url.match(HOSTED)?.[1];
  if (!hosted) return { src: url };
  return {
    src: `${hosted}?w=1200`,
    srcSet: ILLUSTRATION_WIDTHS.map((w) => `${hosted}?w=${w} ${w}w`).join(", "),
  };
}

/** Recadrages servis par /api/media/{id}/illustration?ratio= (JPEG, pour Google). */
export const ILLUSTRATION_CROPS = {
  "4x3": { width: 1200, height: 900 },
  "1x1": { width: 900, height: 900 },
} as const;

export type IllustrationCrop = keyof typeof ILLUSTRATION_CROPS;

/**
 * Variantes 4:3 et 1:1 d'une illustration hébergée, en plus de l'original 16:9.
 * Google les demande pour les carrousels « À la une » et Discover. Vide pour une image externe.
 */
export function illustrationCrops(
  url: string,
): Array<{ url: string; width: number; height: number }> {
  const match = url.match(/^(https?:\/\/[^/]+)?(\/api\/media\/[^/?#]+\/illustration)$/);
  if (!match) return [];
  const origin = match[1] ?? "";
  return (Object.keys(ILLUSTRATION_CROPS) as IllustrationCrop[]).map((ratio) => ({
    url: `${origin}${match[2]}?ratio=${ratio}`,
    ...ILLUSTRATION_CROPS[ratio],
  }));
}

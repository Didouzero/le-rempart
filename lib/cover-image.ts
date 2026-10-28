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

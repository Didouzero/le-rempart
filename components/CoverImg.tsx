import { coverSources } from "@/lib/cover-image";

type CoverImgProps = {
  url: string;
  alt: string;
  /** Largeur affichée, pour que le navigateur choisisse la bonne taille. */
  sizes: string;
  /** Image principale du haut de page (LCP) : chargée tout de suite, en priorité. */
  priority?: boolean;
  className?: string;
};

/** Image de couverture : WebP redimensionné si hébergé, lazy-loading hors écran. */
export function CoverImg({ url, alt, sizes, priority = false, className }: CoverImgProps) {
  const { src, srcSet } = coverSources(url);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}

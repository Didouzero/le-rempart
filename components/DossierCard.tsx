import Link from "next/link";
import { CrownIcon } from "@/components/BrandIcons";
import { PublishedAt } from "@/components/PublishedAt";

export type DossierTeaser = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  coverImageUrl: string | null;
};

function Cover({
  src,
  title,
  featured,
}: {
  src: string | null;
  title: string;
  featured?: boolean;
}) {
  const frame = featured
    ? "media-frame aspect-[16/9] w-full shadow-[var(--shadow-soft)] sm:aspect-[21/9]"
    : "media-frame aspect-[16/10] w-full";

  if (src) {
    return (
      <div className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} />
      </div>
    );
  }

  return (
    <div
      className={`flex w-full items-end rounded-lg bg-ink p-6 ${
        featured ? "aspect-[16/9] sm:aspect-[21/9]" : "aspect-[16/10]"
      }`}
    >
      <span className="inline-flex items-center gap-2 font-display tracking-[0.14em] text-accent">
        <CrownIcon className="h-5 w-5" />
        Enquête
      </span>
    </div>
  );
}

export function DossierCard({
  dossier,
  featured = false,
  locked = false,
  index = 0,
}: {
  dossier: DossierTeaser;
  featured?: boolean;
  locked?: boolean;
  index?: number;
}) {
  const href = locked ? "/s-abonner" : `/dossiers/${dossier.slug}`;
  const delayClass =
    index === 0 ? "" : index === 1 ? "delay-1" : index === 2 ? "delay-2" : "delay-3";

  const meta = (
    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted">
      <span className="font-display text-accent">
        {locked ? "Exclusif Rempart+" : "Enquête"}
      </span>
      <span aria-hidden>•</span>
      <PublishedAt
        value={dossier.publishedAt}
        weekday
        year={false}
        empty="Bientôt"
      />
    </div>
  );

  if (featured) {
    return (
      <article className={`group animate-fade-up ${delayClass}`}>
        <Link href={href} className="block no-underline hover:no-underline">
          <Cover src={dossier.coverImageUrl} title={dossier.title} featured />
        </Link>
        <div className="mt-5 border-l-[3px] border-accent pl-4 sm:pl-5">
          {meta}
          <h2 className="font-display mt-3 text-2xl leading-[1.05] sm:text-3xl md:text-4xl">
            <Link
              href={href}
              className="no-underline hover:text-accent-deep hover:no-underline"
            >
              {dossier.title}
            </Link>
          </h2>
          <p className="mt-4 max-w-3xl text-base italic text-black sm:text-lg">
            {dossier.excerpt}
          </p>
          <Link href={href} className="read-link mt-5">
            {locked ? "Débloquer l'enquête →" : "Lire l'enquête →"}
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className={`group animate-fade-up ${delayClass}`}>
      <Link href={href} className="block no-underline hover:no-underline">
        <Cover src={dossier.coverImageUrl} title={dossier.title} />
        <div className="mt-3">{meta}</div>
        <h2 className="font-display mt-2 text-xl leading-[1.08] sm:text-2xl">
          {dossier.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-base italic text-black">
          {dossier.excerpt}
        </p>
      </Link>
    </article>
  );
}

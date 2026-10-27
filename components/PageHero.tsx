import Image from "next/image";
import type { ReactNode } from "react";

type PageHeroProps = {
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Image de fond assombrie (même traitement que la page Rempart+). */
  image?: string;
  /** Contenu à droite du titre (photo d'auteur, par exemple). */
  aside?: ReactNode;
  children?: ReactNode;
};

/** Bandeau sombre d'en-tête des pages éditoriales, sur le modèle de la page Rempart+. */
export function PageHero({ kicker, title, lead, image, aside, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-lg bg-ink px-5 py-12 text-paper shadow-[var(--shadow-soft)] sm:px-10 sm:py-16">
      {image ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="object-cover object-[center_35%]"
            priority
          />
          <div className="pointer-events-none absolute inset-0 bg-black/76" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-black/35" />
        </>
      ) : null}
      <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="font-display text-[1.05rem] tracking-[0.22em] text-accent">
            {kicker}
          </p>
          <h1 className="font-display mt-3 text-[2.2rem] leading-[0.95] uppercase sm:text-5xl md:text-6xl">
            {title}
          </h1>
          {lead ? (
            <p className="mt-5 max-w-2xl text-base text-white/80 sm:text-lg">{lead}</p>
          ) : null}
          {children}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </section>
  );
}

type InfoCardProps = {
  index?: number;
  kicker: string;
  title: string;
  children: ReactNode;
};

/** Carte claire numérotée (« 01 · Kicker »), comme les avantages Rempart+. */
export function InfoCard({ index, kicker, title, children }: InfoCardProps) {
  return (
    <article className="rounded-lg border border-ink/10 bg-white/55 p-5 shadow-[var(--shadow-soft)]">
      <p className="font-display text-xs tracking-[0.18em] text-accent-deep">
        {index !== undefined ? `0${index} · ` : ""}
        {kicker}
      </p>
      <h3 className="font-display mt-3 text-2xl tracking-[0.06em]">{title}</h3>
      <div className="mt-3 space-y-3 text-[0.95rem] text-muted">{children}</div>
    </article>
  );
}

type SectionTitleProps = { kicker: string; title: ReactNode };

/** Titre de section avec pastille et filet doré. */
export function SectionTitle({ kicker, title }: SectionTitleProps) {
  return (
    <>
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        {kicker}
      </p>
      <h2 className="font-display mt-2 text-3xl tracking-[0.08em] sm:text-4xl">{title}</h2>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
    </>
  );
}

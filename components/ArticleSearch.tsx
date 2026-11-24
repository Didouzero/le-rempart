"use client";

import { useId, useState } from "react";
import { ArrowRightIcon } from "@/components/ArrowRightIcon";

type ListPageHeaderProps = {
  kicker: string;
  title: string;
  /** Nom du site lu par Google et les lecteurs d'écran en tête du titre, sans changer l'affichage. */
  hiddenTitlePrefix?: string;
  description?: string;
  basePath: string;
  q?: string;
  placeholder?: string;
  resultLine?: string | null;
};

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.2 16.2 21 21" strokeLinecap="round" />
    </svg>
  );
}

export function ListPageHeader({
  kicker,
  title,
  hiddenTitlePrefix,
  description,
  basePath,
  q = "",
  placeholder = "Rechercher dans les articles…",
  resultLine,
}: ListPageHeaderProps) {
  const inputId = useId();
  const [open, setOpen] = useState(Boolean(q));

  return (
    <div className="mb-8 animate-fade-up">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        {kicker}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="font-headline min-w-0 text-4xl sm:text-5xl">
          {hiddenTitlePrefix ? (
            <span className="sr-only">{hiddenTitlePrefix}</span>
          ) : null}
          {title}
        </h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`icon-bare inline-flex shrink-0 items-center justify-center p-0.5 transition-colors duration-300 ${
            open ? "text-gold" : "text-ink hover:text-gold"
          }`}
          aria-expanded={open}
          aria-controls={`search-panel-${inputId}`}
          aria-label={open ? "Fermer la recherche" : "Ouvrir la recherche"}
        >
          <SearchIcon className="h-7 w-7" />
        </button>
      </div>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      {description ? (
        <p className="mt-4 max-w-2xl text-base text-muted">{description}</p>
      ) : null}
      <div
        id={`search-panel-${inputId}`}
        className={`grid transition-[grid-template-rows,opacity] duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <form
            action={basePath}
            method="get"
            role="search"
            className={`mt-4 flex w-full max-w-xl flex-row items-center gap-2 transition-transform duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              open ? "translate-y-0" : "-translate-y-2"
            }`}
            aria-hidden={!open}
            {...(!open ? { inert: true } : {})}
          >
            <label className="sr-only" htmlFor={inputId}>
              Rechercher
            </label>
            <input
              id={inputId}
              type="search"
              name="q"
              defaultValue={q}
              placeholder={placeholder}
              autoComplete="off"
              tabIndex={open ? 0 : -1}
              className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-paper px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-accent"
            />
            <button
              type="submit"
              tabIndex={open ? 0 : -1}
              aria-label="Lancer la recherche"
              title="Rechercher"
              className="group h-11 w-11 inline-flex shrink-0 items-center justify-center rounded-lg border border-accent/60 bg-ink text-accent transition duration-300 hover:border-accent hover:text-gold"
            >
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
            {q ? (
              <a
                href={basePath}
                tabIndex={open ? 0 : -1}
                className="font-display flex shrink-0 items-center justify-center rounded-lg px-3 py-2.5 text-sm tracking-[0.12em] text-muted no-underline hover:text-gold"
              >
                Effacer
              </a>
            ) : null}
          </form>
        </div>
      </div>
      {resultLine ? (
        <p className="mt-3 text-sm text-muted">{resultLine}</p>
      ) : null}
    </div>
  );
}

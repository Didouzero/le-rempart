"use client";

import { useId, useState } from "react";

type ListPageHeaderProps = {
  kicker: string;
  title: string;
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
        <h1 className="font-display min-w-0 text-4xl tracking-[0.08em] sm:text-5xl">
          {title}
        </h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center border transition ${
            open
              ? "border-accent bg-accent text-ink"
              : "border-ink/20 text-ink hover:border-accent hover:text-accent-deep"
          }`}
          aria-expanded={open}
          aria-controls={`search-panel-${inputId}`}
          aria-label={open ? "Fermer la recherche" : "Ouvrir la recherche"}
        >
          <SearchIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      {description ? (
        <p className="mt-4 max-w-2xl text-base text-muted">{description}</p>
      ) : null}
      {open ? (
        <form
          id={`search-panel-${inputId}`}
          action={basePath}
          method="get"
          role="search"
          className="mt-4 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch"
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
            autoFocus={!q}
            className="min-w-0 flex-1 border border-ink/15 bg-paper px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <button
            type="submit"
            className="font-display shrink-0 bg-ink px-5 py-2.5 text-sm tracking-[0.14em] text-paper no-underline transition hover:bg-accent hover:text-ink"
          >
            Rechercher
          </button>
          {q ? (
            <a
              href={basePath}
              className="font-display flex shrink-0 items-center justify-center px-3 py-2.5 text-sm tracking-[0.12em] text-muted no-underline hover:text-accent"
            >
              Effacer
            </a>
          ) : null}
        </form>
      ) : null}
      {resultLine ? (
        <p className="mt-3 text-sm text-muted">{resultLine}</p>
      ) : null}
    </div>
  );
}

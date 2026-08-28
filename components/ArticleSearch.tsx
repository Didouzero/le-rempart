type ArticleSearchProps = {
  /** Chemin de base (/, /rubriques/insolite). */
  basePath: string;
  /** Valeur actuelle de ?q= */
  q?: string;
  placeholder?: string;
};

/**
 * Recherche GET dans la liste d'articles (réinitialise la page).
 */
export function ArticleSearch({
  basePath,
  q = "",
  placeholder = "Rechercher dans les articles…",
}: ArticleSearchProps) {
  return (
    <form
      action={basePath}
      method="get"
      role="search"
      className="mt-6 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch"
    >
      <label className="sr-only" htmlFor="article-search-q">
        Rechercher
      </label>
      <input
        id="article-search-q"
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        autoComplete="off"
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
  );
}

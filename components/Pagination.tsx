import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath?: string;
};

export function Pagination({
  page,
  totalPages,
  basePath = "/",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    if (p <= 1) return basePath === "/" ? "/" : basePath;
    const sep = basePath.includes("?") ? "&" : "?";
    // home uses ?page=
    if (basePath === "/") return `/?page=${p}`;
    return `${basePath}${sep}page=${p}`;
  };

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i += 1) pages.push(i);

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="font-display px-3 py-2 text-sm tracking-[0.12em] text-muted no-underline hover:text-accent"
        >
          ←
        </Link>
      ) : null}
      {pages.map((p) => {
        const active = p === page;
        return (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={active ? "page" : undefined}
            className={`font-display min-w-10 px-3 py-2 text-center text-sm tracking-[0.12em] no-underline ${
              active
                ? "text-ink underline decoration-accent decoration-2 underline-offset-4"
                : "text-muted hover:text-accent"
            }`}
          >
            {p}
          </Link>
        );
      })}
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className="font-display px-3 py-2 text-sm tracking-[0.12em] text-muted no-underline hover:text-accent"
        >
          →
        </Link>
      ) : null}
    </nav>
  );
}

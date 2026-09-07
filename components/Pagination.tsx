import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath?: string;
  q?: string;
};

function buildHref(basePath: string, page: number, q?: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  const query = (q || "").trim();
  if (query) params.set("q", query);
  const qs = params.toString();
  if (!qs) return basePath === "/" ? "/" : basePath;
  return `${basePath === "/" ? "/" : basePath}?${qs}`;
}

function visiblePages(totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  return [1, 2, 3, "ellipsis", totalPages - 1, totalPages];
}

export function Pagination({
  page,
  totalPages,
  basePath = "/",
  q,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = visiblePages(totalPages);

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link
          href={buildHref(basePath, page - 1, q)}
          className="font-display px-3 py-2 text-sm tracking-[0.12em] text-muted no-underline hover:text-accent"
        >
          ←
        </Link>
      ) : null}
      {items.map((item) => {
        if (item === "ellipsis") {
          return (
            <span
              key="ellipsis"
              className="font-display px-1 py-2 text-sm tracking-[0.2em] text-muted"
              aria-hidden
            >
              ...
            </span>
          );
        }
        const active = item === page;
        return (
          <Link
            key={item}
            href={buildHref(basePath, item, q)}
            aria-current={active ? "page" : undefined}
            className={`font-display min-w-10 px-3 py-2 text-center text-sm tracking-[0.12em] no-underline ${
              active
                ? "text-ink underline decoration-accent decoration-2 underline-offset-4"
                : "text-muted hover:text-accent"
            }`}
          >
            {item}
          </Link>
        );
      })}
      {page < totalPages ? (
        <Link
          href={buildHref(basePath, page + 1, q)}
          className="font-display px-3 py-2 text-sm tracking-[0.12em] text-muted no-underline hover:text-accent"
        >
          →
        </Link>
      ) : null}
    </nav>
  );
}

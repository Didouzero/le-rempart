import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath?: string;
  /** Conserve ?q= dans les liens de pagination. */
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

export function Pagination({
  page,
  totalPages,
  basePath = "/",
  q,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i += 1) pages.push(i);

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
      {pages.map((p) => {
        const active = p === page;
        return (
          <Link
            key={p}
            href={buildHref(basePath, p, q)}
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
          href={buildHref(basePath, page + 1, q)}
          className="font-display px-3 py-2 text-sm tracking-[0.12em] text-muted no-underline hover:text-accent"
        >
          →
        </Link>
      ) : null}
    </nav>
  );
}

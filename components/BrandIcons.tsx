export function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-current ${className ?? "h-4 w-4"}`}
      aria-hidden
    >
      <svg className="h-[55%] w-[55%]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function HeartCircleIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-current ${className ?? "h-4 w-4"}`}
      aria-hidden
    >
      <svg className="h-[58%] w-[58%]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 19s-7-4.35-7-9.15C5 7.2 6.9 5.5 9.05 5.5c1.24 0 2.32.58 2.95 1.5.63-.92 1.71-1.5 2.95-1.5C17.1 5.5 19 7.2 19 9.85 19 14.65 12 19 12 19z" />
      </svg>
    </span>
  );
}

export function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-3.5 w-3.5"}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3.4 16.2 5.2 8.4c.15-.64.96-.8 1.35-.27L9.5 12l2.05-5.47a.75.75 0 0 1 1.4 0L14.99 12l2.96-3.87c.39-.53 1.2-.37 1.35.27l1.8 7.8a1 1 0 0 1-.97 1.23H4.37a1 1 0 0 1-.97-1.23ZM4 19.25h16a.75.75 0 0 1 0 1.5H4a.75.75 0 0 1 0-1.5Z" />
    </svg>
  );
}

export function LoginCircleIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-ink ${className ?? "h-7 w-7"}`}
      aria-hidden
    >
      <svg
        className="h-[55%] w-[55%]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M10 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 12H3" strokeLinecap="round" />
        <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

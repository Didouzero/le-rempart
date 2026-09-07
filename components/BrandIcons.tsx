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
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-current leading-none ${className ?? "h-7 w-7"}`}
      aria-hidden
    >
      <svg
        className="h-[86%] w-[86%] -translate-y-[5%]"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54Z" />
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
      <path d="M3 17.2 5.1 8.4a.7.7 0 0 1 1.22-.28L9.2 12l2.18-5.7a.7.7 0 0 1 1.24 0L14.8 12l2.88-3.88a.7.7 0 0 1 1.22.28L21 17.2a.85.85 0 0 1-.82 1.05H3.82A.85.85 0 0 1 3 17.2Z" />
      <rect x="3.2" y="19.15" width="17.6" height="1.7" rx="0.35" />
      <circle cx="5.15" cy="7.35" r="1.35" />
      <circle cx="12" cy="5.15" r="1.45" />
      <circle cx="18.85" cy="7.35" r="1.35" />
    </svg>
  );
}

export function CrownCircleIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-accent leading-none ${className ?? "h-8 w-8"}`}
      aria-hidden
    >
      <CrownIcon className="h-[62%] w-[62%]" />
    </span>
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

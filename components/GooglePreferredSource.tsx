/** Page Google où l'internaute ajoute Le Rempart à ses « sources préférées » (bloc « À la une »). */
export const GOOGLE_PREFERRED_SOURCE_URL =
  "https://www.google.com/preferences/source?q=le-rempart.org";

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z" />
    </svg>
  );
}

/**
 * Lien « Ajouter Le Rempart à mes sources Google ». `onDark` pour le pied de page noir.
 */
export function GooglePreferredSource({ onDark = false }: { onDark?: boolean }) {
  return (
    <a
      href={GOOGLE_PREFERRED_SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[0.9rem] no-underline transition hover:no-underline ${
        onDark
          ? "border-white/20 text-white/85 hover:border-accent hover:text-accent"
          : "border-rule bg-card/60 text-ink hover:border-accent hover:text-gold"
      }`}
    >
      <span className="text-gold">
        <StarIcon />
      </span>
      Ajouter Le Rempart à mes sources Google
    </a>
  );
}

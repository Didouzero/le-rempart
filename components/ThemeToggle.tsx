"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark";

/** Prévient les autres boutons de la page (en-tête fixe, menu mobile). */
const THEME_EVENT = "rempart-theme-change";

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Bascule clair / sombre ; le choix est mémorisé sur l'appareil. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const onChange = () => setTheme(currentTheme());
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);

  function applyTheme(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Navigation privée : le choix vaut pour la page en cours.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { ready: Promise<void> };
    };

    if (reduced) {
      applyTheme(next);
      return;
    }

    // Cercle qui s'ouvre depuis le bouton jusqu'au coin le plus éloigné de l'écran.
    if (typeof doc.startViewTransition === "function") {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      const transition = doc.startViewTransition(() => applyTheme(next));
      transition.ready
        .then(() => {
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 650,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => {});
      return;
    }

    // Repli : fondu des couleurs.
    root.classList.add("theme-fading");
    applyTheme(next);
    window.setTimeout(() => root.classList.remove("theme-fading"), 500);
  }

  const label =
    theme === "dark" ? "Passer en mode clair" : "Passer en mode nuit";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`icon-bare inline-flex items-center justify-center p-2 text-accent transition-colors duration-300 hover:text-white ${className}`}
    >
      {/* Avant hydratation, la lune : le bouton garde sa place sans clignoter. */}
      {theme === "dark" ? (
        <span key="sun" className="theme-icon inline-flex">
          <SunIcon />
        </span>
      ) : (
        <span key="moon" className="theme-icon inline-flex">
          <MoonIcon />
        </span>
      )}
    </button>
  );
}

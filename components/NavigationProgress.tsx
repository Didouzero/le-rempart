"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Fine barre dorée en haut de l'écran pendant un changement de page : le lecteur voit que
 * son clic est pris en compte. Purement visuelle, elle ne touche ni au rendu serveur ni
 * aux codes de réponse (contrairement à un loading.tsx, qui transformerait les 404 en 200).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | null>(null);

  // Clic sur un lien interne vers une autre page : la barre démarre.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (form?.method?.toLowerCase() === "get" && form.getAttribute("role") === "search") setState("loading");
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // Nouvelle page affichée : la barre se complète puis disparaît.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 450);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[10060] h-[3px]"
    >
      <div
        className={`h-full bg-accent shadow-[0_0_10px_rgba(255,189,89,0.7)] ${
          state === "loading"
            ? "w-[80%] opacity-100 transition-[width] duration-[2500ms] ease-out"
            : state === "done"
              ? "w-full opacity-0 transition-[width,opacity] duration-300 ease-out"
              : "w-0 opacity-0"
        }`}
      />
    </div>
  );
}

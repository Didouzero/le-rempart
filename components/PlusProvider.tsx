"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { PLUS_HINT_COOKIE } from "@/lib/plus-hint";

const PlusContext = createContext(false);

/**
 * Statut Rempart+ côté navigateur : les pages publiques restent en cache CDN,
 * identiques pour tous ; seuls les visiteurs connectés font un appel au serveur.
 */
export function PlusProvider({ children }: { children: ReactNode }) {
  const [plus, setPlus] = useState(false);

  useEffect(() => {
    const hinted = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${PLUS_HINT_COOKIE}=`) && c.length > PLUS_HINT_COOKIE.length + 1);
    if (!hinted) return;
    let cancelled = false;
    fetch("/api/plus/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { plus?: boolean } | null) => {
        if (!cancelled && data?.plus) setPlus(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <PlusContext.Provider value={plus}>{children}</PlusContext.Provider>;
}

export function usePlus(): boolean {
  return useContext(PlusContext);
}

/** Masqué pour les abonnés Rempart+ (pubs, appels à s'abonner). */
export function HideForPlus({ children }: { children: ReactNode }) {
  return usePlus() ? null : <>{children}</>;
}

/** Visible seulement pour les abonnés Rempart+. */
export function ShowForPlus({ children }: { children: ReactNode }) {
  return usePlus() ? <>{children}</> : null;
}

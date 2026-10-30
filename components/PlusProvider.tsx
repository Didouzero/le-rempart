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
const LAST_CHECK_KEY = "rempart_plus_checked_at";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Sans témoin, une vérification par jour : le cookie de session n'est pas lisible ici. */
function dailyCheckDue(): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY));
    if (last && Date.now() - last < CHECK_INTERVAL_MS) return false;
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {
    // Stockage bloqué : on vérifie à chaque page.
  }
  return true;
}

/**
 * Statut Rempart+ côté navigateur : les pages publiques restent en cache CDN,
 * identiques pour tous. Les visiteurs connectés interrogent le serveur à chaque
 * page ; les autres une fois par jour, pour rattraper une session sans témoin.
 */
export function PlusProvider({ children }: { children: ReactNode }) {
  const [plus, setPlus] = useState(false);

  useEffect(() => {
    const hinted = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${PLUS_HINT_COOKIE}=`) && c.length > PLUS_HINT_COOKIE.length + 1);
    if (!hinted && !dailyCheckDue()) return;
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

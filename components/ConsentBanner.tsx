"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  readConsent,
  saveConsent,
  type ConsentChoice,
} from "@/lib/consent";

/** Vrai quand le visiteur a accepté les cookies (Taboola ne se charge qu'à cette condition). */
export function useConsentGranted(): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    const sync = () => setGranted(readConsent() === "granted");
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);
  return granted;
}

const BUTTON =
  "font-display flex-1 rounded-lg px-4 py-2.5 text-sm tracking-[0.12em] transition duration-200";

/**
 * Petit bandeau de consentement en bas d'écran. « Refuser » et « Accepter »
 * ont le même poids, comme l'exige la CNIL ; le lien « Gérer les cookies »
 * du pied de page le rouvre.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(readConsent() === null);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  function choose(choice: ConsentChoice) {
    saveConsent(choice);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookies"
      className="animate-fade-up fixed inset-x-3 bottom-3 z-[10050] rounded-lg border border-accent/40 bg-ink p-4 text-paper shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:inset-x-auto sm:left-4 sm:max-w-[26rem]"
    >
      <p className="m-0 text-sm leading-snug text-white/85">
        Nous utilisons des cookies pour mesurer l&apos;audience (Google
        Analytics). Les publicités (MGID), affichées sauf aux abonnés
        Rempart+, peuvent déposer leurs propres cookies.{" "}
        <Link
          href="/confidentialite#cookies"
          className="text-accent underline decoration-accent/60 underline-offset-2"
        >
          En savoir plus
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose("denied")}
          className={`${BUTTON} border border-accent/60 text-accent hover:border-accent hover:bg-white/5`}
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => choose("granted")}
          className={`${BUTTON} bg-accent text-ink hover:bg-accent-deep`}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}

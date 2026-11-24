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
  "font-display rounded-md px-4 py-2 text-[0.85rem] tracking-[0.08em] transition duration-200";

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
      className="fixed inset-x-0 bottom-0 z-[10050] border-t border-accent/30 bg-ink px-4 py-3 text-paper shadow-[0_-8px_30px_rgba(0,0,0,0.35)] sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-6">
      <p className="m-0 flex-1 text-[0.8rem] leading-snug text-white/80 sm:text-[0.85rem]">
        Cookies de mesure d&apos;audience (Google Analytics) et publicitaires
        (MGID, sauf abonnés Rempart+).{" "}
        <Link
          href="/confidentialite#cookies"
          className="text-accent underline decoration-accent/60 underline-offset-2"
        >
          En savoir plus
        </Link>
      </p>
      <div className="flex shrink-0 gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
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
    </div>
  );
}

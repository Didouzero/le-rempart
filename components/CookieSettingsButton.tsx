"use client";

import { CONSENT_OPEN_EVENT } from "@/lib/consent";

/** Rouvre le bandeau de consentement : le visiteur peut changer d'avis à tout moment. */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className="cursor-pointer border-0 bg-transparent p-0 text-white/75 underline-offset-4 hover:text-accent hover:underline"
    >
      Gérer les cookies
    </button>
  );
}

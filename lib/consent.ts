/**
 * Consentement aux cookies, géré par le site (bandeau maison) :
 * mesure d'audience (Google Analytics via Consent Mode v2). MGID n'en dépend pas.
 * Le choix est gardé 6 mois sur l'appareil, puis le bandeau revient.
 */
export const CONSENT_STORAGE_KEY = "rempart-consent";
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000;
/** Émis quand le visiteur fait un choix. */
export const CONSENT_EVENT = "rempart-consent-change";
/** Émis par le lien « Gérer les cookies » pour rouvrir le bandeau. */
export const CONSENT_OPEN_EVENT = "rempart-consent-open";

export type ConsentChoice = "granted" | "denied";

export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const { v, t } = JSON.parse(raw) as { v?: string; t?: number };
    if ((v !== "granted" && v !== "denied") || !t) return null;
    if (Date.now() - t > CONSENT_MAX_AGE_MS) return null;
    return v;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ v: choice, t: Date.now() }),
    );
  } catch {
    // Navigation privée : le choix vaut pour la page en cours.
  }
  const w = window as Window & { gtag?: (...args: unknown[]) => void };
  w.gtag?.("consent", "update", {
    analytics_storage: choice,
  });
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/**
 * Consent Mode v2, exécuté dans le <head> avant Tag Manager et GA4 :
 * tout est refusé, sauf la mesure d'audience si le visiteur l'a acceptée
 * il y a moins de 6 mois. Aucune publicité Google n'est utilisée.
 */
export const CONSENT_DEFAULT_SCRIPT = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
var granted = false;
try {
  var c = JSON.parse(localStorage.getItem('${CONSENT_STORAGE_KEY}') || 'null');
  granted = !!c && c.v === 'granted' && Date.now() - c.t < ${CONSENT_MAX_AGE_MS};
} catch (e) {}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: granted ? 'granted' : 'denied'
});`;

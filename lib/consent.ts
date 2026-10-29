/**
 * CMP Sirdata (ABconsent), certifiée IAB TCF : recueille le consentement aux cookies
 * et le transmet à Google (Consent Mode v2) et à MGID (vendor IAB 358).
 * Identifiants publics, lus dans « Récupérer le code » du compte ABconsent (configuration Le Rempart).
 */
export function sirdataCmpIds(): { partner: string; config: string } | null {
  const partner = process.env.NEXT_PUBLIC_SIRDATA_PARTNER_ID?.trim() || "55127";
  const config = process.env.NEXT_PUBLIC_SIRDATA_CONFIG_ID?.trim() || "KwJTJ";
  if (!partner || !config) return null;
  if (!/^[A-Za-z0-9]+$/.test(partner) || !/^[A-Za-z0-9]+$/.test(config)) return null;
  return { partner, config };
}

/**
 * Consent Mode v2 : tout est refusé tant que le visiteur n'a pas répondu au bandeau.
 * Doit s'exécuter avant la CMP, Tag Manager et GA4.
 */
export const CONSENT_DEFAULT_SCRIPT = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});`;

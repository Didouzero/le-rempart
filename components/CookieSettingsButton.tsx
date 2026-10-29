const LINK_CLASS =
  "text-white/75 no-underline underline-offset-4 hover:text-accent hover:underline";

/**
 * Rouvre le bandeau de consentement : le visiteur peut changer d'avis à tout moment.
 * Sirdata repère ce lien précis dans le HTML initial pour masquer son icône flottante
 * (option « Gérer dans le footer ») ; React refuse les liens javascript:, d'où le HTML brut.
 */
export function CookieSettingsButton() {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: `<a href="javascript:window.Sddan.cmp.displayUI();" class="${LINK_CLASS}">Gérer les cookies</a>`,
      }}
    />
  );
}

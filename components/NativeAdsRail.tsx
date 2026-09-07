/**
 * Native advertising (Taboola) — « Vous pourriez aussi aimer ».
 * AdSense slots elsewhere are kept for a possible return later.
 */
export function NativeAdsRail() {
  const enabled = process.env.NEXT_PUBLIC_TABOOLA_ENABLED === "true";
  const publisher = process.env.NEXT_PUBLIC_TABOOLA_PUBLISHER_ID?.trim();
  const placement =
    process.env.NEXT_PUBLIC_TABOOLA_PLACEMENT?.trim() ||
    "Below Article Thumbnails";

  if (!enabled || !publisher) {
    // Structure prête ; inactive tant que Taboola n'est pas branché.
    return (
      <section
        className="mt-12 border-t border-ink/20 pt-10"
        aria-label="Contenus sponsorisés"
        data-ads="taboola-pending"
      >
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Partenaires
        </p>
        <h2 className="font-display mt-2 text-2xl tracking-[0.08em] sm:text-3xl">
          Vous pourriez aussi aimer
        </h2>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
        <ul className="mt-8 grid list-none gap-5 p-0 sm:grid-cols-3">
          {[
            {
              kind: "Article sponsorisé",
              title: "Une nouvelle solution pour réduire vos dépenses…",
            },
            {
              kind: "Article sponsorisé",
              title: "Les Français adoptent cette nouvelle technologie…",
            },
            {
              kind: "Produit",
              title: "Cette offre fait actuellement parler d’elle…",
            },
          ].map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-ink/10 bg-white/40 p-4 opacity-80"
            >
              <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                {item.kind}
              </p>
              <p className="font-display mt-2 text-base leading-snug text-ink">
                {item.title}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Emplacement native advertising (Taboola). Activez{" "}
          <code className="text-ink">NEXT_PUBLIC_TABOOLA_ENABLED</code> avec
          votre publisher ID pour charger le widget réel.
        </p>
      </section>
    );
  }

  const containerId = "taboola-below-article-thumbnails";

  return (
    <section className="mt-12 border-t border-ink/20 pt-10" aria-label="Contenus sponsorisés">
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Partenaires
      </p>
      <h2 className="font-display mt-2 text-2xl tracking-[0.08em] sm:text-3xl">
        Vous pourriez aussi aimer
      </h2>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      <div id={containerId} className="mt-8 min-h-[120px]" />
      <script
        dangerouslySetInnerHTML={{
          __html: `
window._taboola = window._taboola || [];
_taboola.push({
  mode: 'alternating-thumbnails-a',
  container: '${containerId}',
  placement: ${JSON.stringify(placement)},
  target_type: 'mix'
});
`.trim(),
        }}
      />
      <script
        async
        src={`//cdn.taboola.com/libtrc/${encodeURIComponent(publisher)}/loader.js`}
      />
    </section>
  );
}

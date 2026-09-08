"use client";

import Script from "next/script";
import { MgidSiteScript, MgidWidget } from "@/components/MgidLoader";
import {
  mgidEnabled,
  mgidUnderArticleWidgetId,
} from "@/lib/mgid";

/**
 * Native ads — MGID en priorité, Taboola en repli.
 * AdSense (AdSlot) reste ailleurs, éteint tant que Google refuse.
 */
export function NativeAdsRail() {
  const mgidWidget = mgidUnderArticleWidgetId();

  if (mgidEnabled() && mgidWidget) {
    return (
      <section
        className="mt-12 border-t border-ink/20 pt-10"
        aria-label="Contenus sponsorisés"
      >
        <p className="section-kicker">
          <span className="live-dot" aria-hidden />
          Partenaires
        </p>
        <h2 className="font-display mt-2 text-2xl tracking-[0.08em] sm:text-3xl">
          Vous pourriez aussi aimer
        </h2>
        <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
        <div className="mt-8 min-h-[120px]">
          <MgidWidget widgetId={mgidWidget} />
        </div>
        <MgidSiteScript />
      </section>
    );
  }

  const enabled = process.env.NEXT_PUBLIC_TABOOLA_ENABLED === "true";
  const publisher = process.env.NEXT_PUBLIC_TABOOLA_PUBLISHER_ID?.trim();
  const placement =
    process.env.NEXT_PUBLIC_TABOOLA_PLACEMENT?.trim() ||
    "Below Article Thumbnails";

  if (!enabled || !publisher) {
    return null;
  }

  const containerId = "taboola-below-article-thumbnails";
  const loaderSrc = `https://cdn.taboola.com/libtrc/${encodeURIComponent(publisher)}/loader.js`;

  return (
    <section
      className="mt-12 border-t border-ink/20 pt-10"
      aria-label="Contenus sponsorisés"
    >
      <p className="section-kicker">
        <span className="live-dot" aria-hidden />
        Partenaires
      </p>
      <h2 className="font-display mt-2 text-2xl tracking-[0.08em] sm:text-3xl">
        Vous pourriez aussi aimer
      </h2>
      <div className="gold-rule animate-line-grow mt-3 max-w-xs" />
      <div id={containerId} className="mt-8 min-h-[120px]" />
      <Script id="taboola-page" strategy="afterInteractive">{`
window._taboola = window._taboola || [];
_taboola.push({article: 'auto'});
`}</Script>
      <Script id="taboola-placement" strategy="afterInteractive">{`
window._taboola = window._taboola || [];
_taboola.push({
  mode: 'alternating-thumbnails-a',
  container: ${JSON.stringify(containerId)},
  placement: ${JSON.stringify(placement)},
  target_type: 'mix'
});
`}</Script>
      <Script src={loaderSrc} strategy="afterInteractive" />
      <Script id="taboola-flush" strategy="lazyOnload">{`
window._taboola = window._taboola || [];
_taboola.push({flush: true});
`}</Script>
    </section>
  );
}

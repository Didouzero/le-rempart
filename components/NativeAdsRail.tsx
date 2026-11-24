"use client";

import Script from "next/script";
import { MgidSiteScript, MgidWidget } from "@/components/MgidLoader";
import { useConsentGranted } from "@/components/ConsentBanner";
import { usePlus } from "@/components/PlusProvider";
import { ADS_PAUSED, mgidEnabled, mgidUnderArticleWidgetId } from "@/lib/mgid";

/**
 * Native ads — MGID en priorité, Taboola en repli.
 * AdSense (AdSlot) reste ailleurs, éteint tant que Google refuse.
 */
export function NativeAdsRail() {
  const plus = usePlus();
  const consented = useConsentGranted();
  const mgidWidget = mgidUnderArticleWidgetId();

  if (plus || ADS_PAUSED) return null;

  if (mgidEnabled() && mgidWidget) {
    return (
      <section
        className="mt-14 border-t border-rule pt-6"
        aria-label="Contenus sponsorisés"
      >
        <h2 className="font-display text-[0.8rem] tracking-[0.14em] text-muted">
          Contenus sponsorisés
        </h2>
        <div className="mt-4 min-h-[120px]">
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

  if (!enabled || !publisher || !consented) {
    return null;
  }

  const containerId = "taboola-below-article-thumbnails";
  const loaderSrc = `https://cdn.taboola.com/libtrc/${encodeURIComponent(publisher)}/loader.js`;

  return (
    <section
      className="mt-14 border-t border-rule pt-6"
      aria-label="Contenus sponsorisés"
    >
      <h2 className="font-display text-[0.8rem] tracking-[0.14em] text-muted">
        Contenus sponsorisés
      </h2>
      <div id={containerId} className="mt-4 min-h-[120px]" />
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

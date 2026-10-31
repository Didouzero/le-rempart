"use client";

import Script from "next/script";
import { mgidSiteId } from "@/lib/mgid";

export function MgidWidget({ widgetId }: { widgetId: string }) {
  return <div data-type="_mgwidget" data-widget-id={widgetId} />;
}

/** Un seul loader par page (Next déduplique via l’id), quel que soit le choix sur les cookies. */
export function MgidSiteScript() {
  const site = mgidSiteId();
  if (!site) return null;

  return (
    <>
      <Script
        id="mgid-site"
        src={`https://jsc.mgid.com/site/${encodeURIComponent(site)}.js`}
        // Après le chargement de la page : ~1 s de CPU sur mobile, hors affichage initial.
        strategy="lazyOnload"
      />
      <Script id="mgid-load" strategy="lazyOnload">{`
(function(w,q){w[q]=w[q]||[];w[q].push(["_mgc.load"])})(window,"_mgq");
`}</Script>
    </>
  );
}

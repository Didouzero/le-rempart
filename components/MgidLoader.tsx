"use client";

import Script from "next/script";
import { mgidSiteId } from "@/lib/mgid";

export function MgidWidget({ widgetId }: { widgetId: string }) {
  return <div data-type="_mgwidget" data-widget-id={widgetId} />;
}

/** Un seul loader par page (Next déduplique via l’id). */
export function MgidSiteScript() {
  const site = mgidSiteId();
  if (!site) return null;

  return (
    <>
      <Script
        id="mgid-site"
        src={`https://jsc.mgid.com/site/${encodeURIComponent(site)}.js`}
        strategy="afterInteractive"
      />
      <Script id="mgid-load" strategy="lazyOnload">{`
(function(w,q){w[q]=w[q]||[];w[q].push(["_mgc.load"])})(window,"_mgq");
`}</Script>
    </>
  );
}

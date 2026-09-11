"use client";

import { useEffect, useState } from "react";
import { MgidSiteScript, MgidWidget } from "@/components/MgidLoader";
import { mgidEnabled, mgidInArticleWidgetId } from "@/lib/mgid";

const DESKTOP_XL = "(min-width: 1280px)";

/**
 * Widget MGID In-Article, mobile uniquement.
 * Hors du DOM sous xl pour ne pas charger un 3e unit sur desktop
 * (les rails gauche/droite restent inchangés).
 */
export function MgidInArticle() {
  const widgetId = mgidInArticleWidgetId();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (!mgidEnabled() || !widgetId) return;
    const mq = window.matchMedia(DESKTOP_XL);
    const apply = () => setMobile(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [widgetId]);

  useEffect(() => {
    if (!mobile || !widgetId) return;
    const w = window as Window & { _mgq?: unknown[] };
    w._mgq = w._mgq || [];
    w._mgq.push(["_mgc.load"]);
  }, [mobile, widgetId]);

  if (!mgidEnabled() || !widgetId || !mobile) return null;

  return (
    <aside
      className="article-in-ad my-8 w-full min-w-0 overflow-x-hidden border-y border-ink/20 py-5"
      aria-label="Publicité"
      data-mgid-slot="in-article-mobile"
    >
      <p className="m-0 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
        Publicité
      </p>
      <div className="mt-3 min-h-[80px] w-full min-w-0 overflow-x-hidden">
        <MgidWidget widgetId={widgetId} />
      </div>
      <MgidSiteScript />
    </aside>
  );
}

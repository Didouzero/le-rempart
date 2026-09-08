"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MgidSiteScript, MgidWidget } from "@/components/MgidLoader";
import {
  mgidLeftWidgetId,
  mgidRightWidgetId,
  mgidSideRailsEnabled,
} from "@/lib/mgid";

type ArticleSideAdsProps = {
  children: ReactNode;
  show: boolean;
};

function Rail({
  widgetId,
  label,
}: {
  widgetId: string;
  label: string;
}) {
  return (
    <aside
      className="article-side-ad sticky top-24 max-h-[calc(100vh-6.5rem)] self-start overflow-x-hidden overflow-y-auto [scrollbar-width:none]"
      aria-label={label}
    >
      <MgidWidget widgetId={widgetId} />
    </aside>
  );
}

/**
 * Pubs MGID à gauche et à droite du texte, desktop (xl / 1280px+) seulement.
 * Titre et photo restent pleine largeur ; pas de widgets MGID sur mobile.
 */
export function ArticleSideAds({ children, show }: ArticleSideAdsProps) {
  const left = mgidLeftWidgetId();
  const right = mgidRightWidgetId();
  const adsenseOn = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
  const configured = show && !adsenseOn && mgidSideRailsEnabled();
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!configured || !desktop || (!left && !right)) {
    return children;
  }

  const cols =
    left && right
      ? "grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_minmax(0,9.5rem)]"
      : left
        ? "grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)]"
        : "grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)]";

  return (
    <>
      <div className={`grid items-start gap-5 ${cols}`}>
        {left ? <Rail widgetId={left} label="Publicité gauche" /> : null}
        <div className="min-w-0">{children}</div>
        {right ? <Rail widgetId={right} label="Publicité droite" /> : null}
      </div>
      <MgidSiteScript />
    </>
  );
}

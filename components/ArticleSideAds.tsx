"use client";

import type { ReactNode } from "react";
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
      className="article-side-ad hidden xl:sticky xl:top-24 xl:block xl:max-h-[calc(100vh-6.5rem)] xl:self-start xl:overflow-x-hidden xl:overflow-y-auto xl:[scrollbar-width:none]"
      aria-label={label}
    >
      <MgidWidget widgetId={widgetId} />
    </aside>
  );
}

/**
 * Pubs MGID à gauche et à droite du texte, desktop (xl / 1280px+) seulement.
 * Titre et photo restent pleine largeur.
 */
export function ArticleSideAds({ children, show }: ArticleSideAdsProps) {
  const left = mgidLeftWidgetId();
  const right = mgidRightWidgetId();
  const adsenseOn = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
  const enabled = show && !adsenseOn && mgidSideRailsEnabled();

  if (!enabled || (!left && !right)) {
    return children;
  }

  const cols =
    left && right
      ? "xl:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_minmax(0,9.5rem)]"
      : left
        ? "xl:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)]"
        : "xl:grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)]";

  return (
    <>
      <div className={`xl:grid xl:items-start xl:gap-5 ${cols}`}>
        {left ? <Rail widgetId={left} label="Publicité gauche" /> : null}
        <div className="min-w-0">{children}</div>
        {right ? <Rail widgetId={right} label="Publicité droite" /> : null}
      </div>
      <MgidSiteScript />
    </>
  );
}

export function mgidEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_MGID_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_MGID_SITE_ID?.trim())
  );
}

export function mgidSiteId(): string | undefined {
  return process.env.NEXT_PUBLIC_MGID_SITE_ID?.trim() || undefined;
}

export function mgidUnderArticleWidgetId(): string | undefined {
  return process.env.NEXT_PUBLIC_MGID_WIDGET_ID?.trim() || undefined;
}

export function mgidLeftWidgetId(): string | undefined {
  return process.env.NEXT_PUBLIC_MGID_WIDGET_ID_LEFT?.trim() || undefined;
}

export function mgidRightWidgetId(): string | undefined {
  return process.env.NEXT_PUBLIC_MGID_WIDGET_ID_RIGHT?.trim() || undefined;
}

/**
 * Widget In-Article mobile. ID distinct obligatoire : réutiliser
 * under-article / rails ferait double-remplissage du même unit.
 */
/** Widget In-Article mobile (dashboard MGID, distinct des rails / under-article). */
const MGID_IN_ARTICLE_WIDGET_ID = "2081657";

export function mgidInArticleWidgetId(): string | undefined {
  const id =
    process.env.NEXT_PUBLIC_MGID_WIDGET_ID_IN_ARTICLE?.trim() ||
    MGID_IN_ARTICLE_WIDGET_ID;
  if (!id) return undefined;
  const used = new Set(
    [mgidUnderArticleWidgetId(), mgidLeftWidgetId(), mgidRightWidgetId()].filter(
      Boolean,
    ),
  );
  if (used.has(id)) return undefined;
  return id;
}

export function mgidSideRailsEnabled(): boolean {
  return mgidEnabled() && Boolean(mgidLeftWidgetId() || mgidRightWidgetId());
}

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

export function mgidSideRailsEnabled(): boolean {
  return mgidEnabled() && Boolean(mgidLeftWidgetId() || mgidRightWidgetId());
}

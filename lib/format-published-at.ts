const PARIS = "Europe/Paris";

function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function publishedAtIso(
  value: Date | string | null,
): string | undefined {
  return asDate(value)?.toISOString();
}

/** Heure Paris, 24 h : 9h05, 10h08, 14h03. */
export function formatPublishedAtTime(
  value: Date | string | null,
): string {
  const date = asDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("fr-FR", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: PARIS,
  }).formatToParts(date);
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minute = (parts.find((p) => p.type === "minute")?.value ?? "00").padStart(
    2,
    "0",
  );
  const hour = String(Number.parseInt(hourRaw, 10));
  return `${hour}h${minute}`;
}

export function formatPublishedAtDate(
  value: Date | string | null,
  opts?: { weekday?: boolean; year?: boolean },
): string {
  const date = asDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: opts?.weekday ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: opts?.year === false ? undefined : "numeric",
    timeZone: PARIS,
  }).format(date);
}

/** Date + heure : « 11 septembre 2026 · 10h08 ». */
export function formatPublishedAt(
  value: Date | string | null,
  opts?: { weekday?: boolean; year?: boolean },
): string {
  const date = formatPublishedAtDate(value, opts);
  const time = formatPublishedAtTime(value);
  if (!date) return "";
  return time ? `${date} · ${time}` : date;
}

/** Créneaux de publication (heure locale Europe/Paris). */
export const VEILLE_SLOTS_PARIS = [8, 10, 12, 14, 16, 18, 20] as const;

export function parisNowParts(date = new Date()): {
  hour: number;
  dateKey: string; // YYYY-MM-DD Paris
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // hour12 false can still give "24" at midnight in some engines
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    hour,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function currentVeilleSlot(date = new Date()): {
  inSlot: boolean;
  hour: number;
  dateKey: string;
  slotKey: string;
} {
  const { hour, dateKey } = parisNowParts(date);
  const inSlot = (VEILLE_SLOTS_PARIS as readonly number[]).includes(hour);
  return {
    inSlot,
    hour,
    dateKey,
    slotKey: `${dateKey}-${String(hour).padStart(2, "0")}`,
  };
}

import { prisma } from "@/lib/prisma";

const VEILLE_ENABLED_KEY = "veille_enabled";

/** Par défaut : OFF (évite les pubs auto surprises). */
export async function isVeilleEnabled(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({
    where: { key: VEILLE_ENABLED_KEY },
  });
  if (!row) return false;
  return row.value === "1" || row.value === "true";
}

export async function setVeilleEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: VEILLE_ENABLED_KEY },
    create: { key: VEILLE_ENABLED_KEY, value: enabled ? "1" : "0" },
    update: { value: enabled ? "1" : "0" },
  });
}

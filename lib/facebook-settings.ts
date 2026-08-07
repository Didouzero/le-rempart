import { prisma } from "@/lib/prisma";

const FB_PUBLISH_KEY = "facebook_publish_enabled";

/**
 * Pub Facebook via API — OFF par défaut.
 * Meta bloque souvent les pubs automatiques même quand le post manuel marche.
 * Réactiver : /fb_on  ou  FACEBOOK_PUBLISH_ENABLED=true
 */
export async function isFacebookPublishEnabled(): Promise<boolean> {
  const env = process.env.FACEBOOK_PUBLISH_ENABLED?.trim().toLowerCase();
  if (env === "0" || env === "false" || env === "off") return false;
  if (env === "1" || env === "true" || env === "on") return true;

  const row = await prisma.appSetting.findUnique({
    where: { key: FB_PUBLISH_KEY },
  });
  if (!row) return false;
  return row.value === "1" || row.value === "true";
}

export async function setFacebookPublishEnabled(
  enabled: boolean,
): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: FB_PUBLISH_KEY },
    create: { key: FB_PUBLISH_KEY, value: enabled ? "1" : "0" },
    update: { value: enabled ? "1" : "0" },
  });
}

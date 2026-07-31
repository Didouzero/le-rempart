type AdSlotProps = {
  slot: string;
  className?: string;
};

/** Pubs visibles seulement quand AdSense est explicitement activé. */
export function adsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
}

/**
 * Emplacement AdSense. Masqué tant que NEXT_PUBLIC_ADSENSE_ENABLED !== "true".
 */
export function AdSlot({ slot, className = "" }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

  if (!adsEnabled() || !client) {
    return null;
  }

  return (
    <aside
      className={`my-8 min-h-[90px] w-full ${className}`}
      aria-label="Publicité"
      data-ad-client={client}
      data-ad-slot={slot}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: 90 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

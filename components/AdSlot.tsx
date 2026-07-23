type AdSlotProps = {
  slot: string;
  className?: string;
};

/**
 * Placeholder AdSense slot. Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT is set.
 */
export function AdSlot({ slot, className = "" }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  if (!client) {
    return null;
  }

  return (
    <aside
      className={`my-8 flex min-h-[90px] items-center justify-center border border-dashed border-rule bg-white/40 text-xs text-muted ${className}`}
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

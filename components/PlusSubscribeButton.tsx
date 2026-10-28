import Link from "next/link";
import { CrownCircleIcon } from "@/components/BrandIcons";

/** Bouton doré « S'abonner au Rempart+ » (rubrique Enquêtes, aperçu d'enquête). */
export function PlusSubscribeButton() {
  return (
    <Link
      href="/s-abonner"
      className="group inline-flex items-center gap-3 rounded-lg border border-accent/50 bg-accent px-5 py-3 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-deep hover:no-underline hover:shadow-[0_12px_28px_rgba(255,189,89,0.45)]"
    >
      <CrownCircleIcon className="h-8 w-8" />
      <span className="flex flex-col text-left leading-none">
        <span className="font-display text-[1.05rem] tracking-[0.14em]">
          S&apos;abonner
        </span>
        <span className="font-display mt-0.5 text-[1.05rem] tracking-[0.14em]">
          au Rempart+
        </span>
      </span>
    </Link>
  );
}

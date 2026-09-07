"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrownCircleIcon, LoginCircleIcon } from "@/components/BrandIcons";

type MobileAccountTilesProps = {
  isPlus?: boolean;
};

const HIDDEN_PATHS = new Set(["/s-abonner", "/connexion"]);

export function MobileAccountTiles({ isPlus = false }: MobileAccountTilesProps) {
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isPlus || HIDDEN_PATHS.has(pathname)) return null;

  return createPortal(
    <div
      className="flex flex-row items-stretch gap-1.5 lg:hidden"
      style={{
        position: "fixed",
        top: "calc(3.35rem + env(safe-area-inset-top, 0px) + 0.4rem)",
        right: "max(0.65rem, env(safe-area-inset-right, 0px))",
        zIndex: 10045,
      }}
    >
      <Link
        href="/connexion"
        className="group inline-flex items-center gap-1.5 rounded-lg border border-accent/50 bg-ink px-2 py-1.5 text-accent no-underline shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition duration-300 hover:border-accent hover:bg-accent hover:text-ink hover:no-underline"
      >
        <LoginCircleIcon className="h-6 w-6 group-hover:bg-ink group-hover:text-accent" />
        <span className="flex min-w-0 flex-col leading-none text-left">
          <span className="font-display text-[0.68rem] tracking-[0.1em]">
            Se connecter
          </span>
          <span className="mt-0.5 text-[0.5rem] tracking-[0.06em] text-white/65 group-hover:text-ink/70">
            Déjà abonné
          </span>
        </span>
      </Link>
      <Link
        href="/s-abonner"
        className="group inline-flex w-[8.1rem] items-center gap-1.5 rounded-lg border border-accent/50 bg-accent px-2 py-1.5 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:border-accent hover:bg-accent-deep hover:no-underline"
      >
        <CrownCircleIcon className="h-6 w-6" />
        <span className="flex min-w-0 flex-col leading-none text-left">
          <span className="font-display text-[0.68rem] tracking-[0.1em]">
            S&apos;abonner
          </span>
          <span className="font-display mt-0.5 text-[0.68rem] tracking-[0.1em]">
            au Rempart+
          </span>
        </span>
      </Link>
    </div>,
    document.body,
  );
}

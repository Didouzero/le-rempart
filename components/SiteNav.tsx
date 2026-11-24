"use client";

import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ARTICLE_CATEGORIES, CATEGORY_META, PREMIUM_CATEGORY } from "@/lib/categories";
import { CrownIcon } from "@/components/BrandIcons";
import { HideForPlus } from "@/components/PlusProvider";

const homeLink = { href: "/", label: "Dernières news" } as const;

const rubriqueLinks = [
  ...ARTICLE_CATEGORIES.map((key) => ({
    href: `/rubriques/${CATEGORY_META[key].slug}`,
    label: CATEGORY_META[key].short,
    premium: false as const,
  })),
  {
    href: PREMIUM_CATEGORY.path,
    label: PREMIUM_CATEGORY.short,
    premium: true as const,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo-wordmark.png"
      alt="Le Rempart"
      width={791}
      height={127}
      className={`h-auto ${className}`}
      priority
    />
  );
}

function SubscribeButton({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/s-abonner"
      className={`font-display inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent text-ink no-underline transition hover:bg-accent-deep hover:no-underline ${
        small ? "px-2.5 py-1.5 text-[0.8rem] tracking-[0.06em]" : "px-3.5 py-2 text-[0.92rem] tracking-[0.07em]"
      }`}
    >
      <CrownIcon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
      S&apos;abonner
    </Link>
  );
}

function DesktopBar() {
  const pathname = usePathname() || "/";
  const links = [{ ...homeLink, premium: false as const }, ...rubriqueLinks];

  return (
    <div className="mx-auto hidden h-16 w-full max-w-6xl items-center gap-8 px-6 lg:flex">
      <Link
        href="/"
        className="flex shrink-0 flex-col items-start no-underline hover:no-underline"
        aria-label="Le Rempart, accueil"
      >
        <BrandWordmark className="w-[8.75rem]" />
        <span className="font-tagline mt-1 text-[0.56rem] tracking-[0.2em] text-white/55">
          Le média de droite radicale
        </span>
      </Link>

      <nav className="flex min-w-0 flex-1 items-center justify-center" aria-label="Navigation principale">
        <ul className="flex items-center gap-6">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            const home = link.href === "/";
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`font-display relative inline-flex h-16 items-center gap-1.5 whitespace-nowrap text-[0.95rem] tracking-[0.07em] no-underline transition-colors hover:text-accent hover:no-underline ${
                    active ? "text-accent" : "text-white/85"
                  }`}
                >
                  {home ? <span className="live-dot shrink-0" aria-hidden /> : null}
                  {link.label}
                  {link.premium ? <CrownIcon className="h-3.5 w-3.5 text-accent" /> : null}
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-accent" aria-hidden />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex shrink-0 items-center gap-4">
        <ThemeToggle />
        <HideForPlus>
          <Link
            href="/connexion"
            className="font-display text-[0.88rem] tracking-[0.07em] text-white/75 no-underline transition-colors hover:text-accent hover:no-underline"
          >
            Se connecter
          </Link>
          <SubscribeButton />
        </HideForPlus>
      </div>
    </div>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-4 w-5" aria-hidden>
      <span
        className={`absolute left-0 block h-[2px] w-full bg-accent transition-all duration-300 ease-out ${
          open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
        }`}
      />
      <span
        className={`absolute left-0 top-1/2 block h-[2px] w-full -translate-y-1/2 bg-accent transition-all duration-300 ease-out ${
          open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
        }`}
      />
      <span
        className={`absolute left-0 block h-[2px] w-full bg-accent transition-all duration-300 ease-out ${
          open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
        }`}
      />
    </span>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() || "/";
  const links = [{ ...homeLink, premium: false as const }, ...rubriqueLinks];

  return (
    <div
      id="mobile-nav-drawer"
      style={{ zIndex: 10060 }}
      className={`fixed inset-0 lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      role="dialog"
      aria-modal={open}
      aria-hidden={!open}
      aria-label="Menu"
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Fermer le menu"
        className={`absolute inset-0 bg-ink/92 transition-opacity duration-300 ease-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-[min(100%,22rem)] flex-col bg-ink px-6 py-7 shadow-[-12px_0_40px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between gap-3">
          <BrandWordmark className="w-[9rem]" />
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            className="font-display shrink-0 text-sm tracking-[0.1em] text-white/70 transition-colors hover:text-accent"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>

        <nav className="flex flex-col" aria-label="Navigation mobile">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                tabIndex={open ? 0 : -1}
                aria-current={active ? "page" : undefined}
                className={`font-display flex items-center gap-2 border-b border-white/10 py-3.5 text-[1.15rem] tracking-[0.07em] no-underline hover:text-accent hover:no-underline ${
                  active ? "text-accent" : "text-white"
                }`}
                style={{ color: active ? undefined : "#fff" }}
                onClick={onClose}
              >
                {link.href === "/" ? <span className="live-dot shrink-0" aria-hidden /> : null}
                {link.label}
                {link.premium ? <CrownIcon className="h-4 w-4 text-accent" /> : null}
              </Link>
            );
          })}
          <Link
            href="/contact"
            tabIndex={open ? 0 : -1}
            className="font-display border-b border-white/10 py-3.5 text-[1rem] tracking-[0.07em] text-white/60 no-underline hover:text-accent hover:no-underline"
            onClick={onClose}
          >
            Contact
          </Link>
        </nav>

        <HideForPlus>
          <div className="mt-auto flex flex-col gap-3 pt-8">
            <Link
              href="/s-abonner"
              tabIndex={open ? 0 : -1}
              className="font-display flex items-center justify-center gap-2 rounded-md bg-accent py-3 text-[1rem] tracking-[0.07em] text-ink no-underline hover:no-underline"
              onClick={onClose}
            >
              <CrownIcon className="h-4 w-4" />
              S&apos;abonner au Rempart+
            </Link>
            <Link
              href="/connexion"
              tabIndex={open ? 0 : -1}
              className="font-display flex items-center justify-center rounded-md border border-white/20 py-3 text-[0.95rem] tracking-[0.07em] text-white/85 no-underline hover:border-accent hover:text-accent hover:no-underline"
              onClick={onClose}
            >
              Se connecter
            </Link>
          </div>
        </HideForPlus>
      </div>
    </div>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <DesktopBar />

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 lg:hidden">
        <Link href="/" className="inline-flex items-center no-underline hover:no-underline" aria-label="Le Rempart, accueil">
          <BrandWordmark className="w-[8rem]" />
        </Link>
        <div className="flex items-center gap-1.5">
          <HideForPlus>
            <SubscribeButton small />
          </HideForPlus>
          <ThemeToggle />
          <button
            type="button"
            className="icon-bare inline-flex items-center justify-center p-2 text-white transition-colors hover:text-accent"
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <HamburgerIcon open={open} />
          </button>
        </div>
      </div>

      {mounted && createPortal(<MobileDrawer open={open} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

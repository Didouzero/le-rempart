"use client";

import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARTICLE_CATEGORIES, CATEGORY_META, PREMIUM_CATEGORY } from "@/lib/categories";
import { CrownIcon } from "@/components/BrandIcons";
import { HideForPlus } from "@/components/PlusProvider";
import { ArrowRightIcon } from "@/components/ArrowRightIcon";

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

function UserIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" className={className} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.4-4 4.5-6 8-6s6.6 2 8 6" />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.2 16.2 21 21" />
    </svg>
  );
}

const ICON_BUTTON =
  "icon-bare inline-flex h-9 w-9 items-center justify-center text-white/80 transition-colors hover:text-accent";

function AccountLink() {
  return (
    <Link href="/connexion" className={`${ICON_BUTTON} no-underline hover:no-underline`} aria-label="Mon compte" title="Mon compte">
      <UserIcon />
    </Link>
  );
}

function SearchButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={ICON_BUTTON}
      aria-label={open ? "Fermer la recherche" : "Rechercher"}
      title="Rechercher"
      aria-expanded={open}
      aria-controls="header-search"
      onClick={onToggle}
    >
      <SearchIcon />
    </button>
  );
}

/**
 * Barre de recherche sous l'en-tête : toujours montée, elle se déplie en douceur
 * (hauteur, fondu et glissé) et envoie vers les résultats de l'accueil.
 */
function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Le curseur se place dans le champ une fois le dépliage lancé.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 120);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <div
      id="header-search"
      className={`grid transition-[grid-template-rows,opacity] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
      aria-hidden={!open}
      {...(!open ? { inert: true } : {})}
    >
      <div className="overflow-hidden">
        <div className={`border-t transition-colors duration-500 ${open ? "border-white/10" : "border-transparent"}`}>
          <form
            action="/"
            method="get"
            role="search"
            className={`mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:px-6 ${
              open ? "translate-y-0" : "-translate-y-3"
            }`}
          >
            <label htmlFor="header-search-input" className="sr-only">
              Rechercher un article
            </label>
            <SearchIcon className="h-5 w-5 shrink-0 text-white/50" />
            <input
              ref={inputRef}
              id="header-search-input"
              name="q"
              type="search"
              placeholder="Rechercher un article, un nom, une ville…"
              className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-[1rem] text-white placeholder:text-white/40 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
            />
            <button
              type="submit"
              aria-label="Lancer la recherche"
              title="Rechercher"
              className="group h-10 w-10 inline-flex shrink-0 items-center justify-center rounded-lg border border-accent/60 bg-ink text-accent btn-ink transition duration-300 hover:border-accent hover:text-gold"
            >
              <ArrowRightIcon className="h-[1.1rem] w-[1.1rem] transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SubscribeButton({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/s-abonner"
      className={`font-display inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent text-ink no-underline transition hover:bg-accent-deep hover:no-underline ${
        small ? "px-2.5 py-1.5 text-[0.8rem] tracking-[0.06em]" : "px-3.5 py-2 text-[0.92rem] tracking-[0.07em]"
      }`}
    >
      <CrownIcon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {/* Sur les plus petits écrans, la couronne seule : la place va aux icônes de la barre. */}
      <span className={small ? "max-[389px]:sr-only" : undefined}>S&apos;abonner</span>
    </Link>
  );
}

function DesktopBar({ searchOpen, onToggleSearch }: { searchOpen: boolean; onToggleSearch: () => void }) {
  const pathname = usePathname() || "/";
  const links = [{ ...homeLink, premium: false as const }, ...rubriqueLinks];

  return (
    <div className="mx-auto hidden h-16 w-full max-w-6xl items-center gap-5 px-5 lg:flex xl:gap-8 xl:px-6">
      <Link
        href="/"
        className="flex shrink-0 flex-col items-center no-underline hover:no-underline"
        aria-label="Le Rempart, accueil"
      >
        <BrandWordmark className="w-[10.25rem]" />
        <span className="font-tagline mt-1 pl-[0.2em] text-[0.56rem] tracking-[0.2em] text-white/55">
          Le média de droite assumé
        </span>
      </Link>

      <nav className="flex min-w-0 flex-1 items-center justify-center" aria-label="Navigation principale">
        <ul className="flex items-center gap-4 xl:gap-6">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            const home = link.href === "/";
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`font-display relative inline-flex h-16 items-center gap-1.5 whitespace-nowrap text-[0.85rem] tracking-[0.05em] xl:text-[0.95rem] xl:tracking-[0.07em] no-underline transition-colors hover:text-accent hover:no-underline ${
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

      <div className="flex shrink-0 items-center gap-1 xl:gap-2">
        <SearchButton open={searchOpen} onToggle={onToggleSearch} />
        <ThemeToggle />
        <AccountLink />
        <HideForPlus>
          <span className="ml-2">
            <SubscribeButton />
          </span>
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

        <div className="mt-auto flex flex-col gap-3 pt-8">
          <HideForPlus>
            <Link
              href="/s-abonner"
              tabIndex={open ? 0 : -1}
              className="font-display flex items-center justify-center gap-2 rounded-lg bg-accent py-3 text-[1rem] tracking-[0.07em] text-ink no-underline hover:no-underline"
              onClick={onClose}
            >
              <CrownIcon className="h-4 w-4" />
              S&apos;abonner au Rempart+
            </Link>
          </HideForPlus>
          <Link
            href="/connexion"
            tabIndex={open ? 0 : -1}
            className="font-display flex items-center justify-center gap-2 rounded-lg border border-white/20 py-3 text-[0.95rem] tracking-[0.07em] text-white/85 no-underline hover:border-accent hover:text-accent hover:no-underline"
            onClick={onClose}
          >
            <UserIcon className="h-4 w-4" />
            Mon compte
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SiteNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Une recherche lancée ou une nouvelle page referme la barre de recherche.
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

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
      <DesktopBar searchOpen={searchOpen} onToggleSearch={() => setSearchOpen((v) => !v)} />

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 min-[400px]:px-4 lg:hidden">
        <Link href="/" className="inline-flex shrink-0 items-center no-underline hover:no-underline" aria-label="Le Rempart, accueil">
          <BrandWordmark className="w-[6.6rem] min-[400px]:w-[7.25rem]" />
        </Link>
        {/* Recherche, mode jour/nuit et compte dans la barre : icônes de 32 px pour tenir dès 360 px. */}
        <div className="flex items-center gap-0.5 [&_.icon-bare]:h-8 [&_.icon-bare]:w-8">
          <HideForPlus>
            <SubscribeButton small />
          </HideForPlus>
          <SearchButton open={searchOpen} onToggle={() => setSearchOpen((v) => !v)} />
          <ThemeToggle />
          <AccountLink />
          <button
            type="button"
            className="icon-bare inline-flex items-center justify-center p-1.5 text-white transition-colors hover:text-accent"
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <HamburgerIcon open={open} />
          </button>
        </div>
      </div>

      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />

      {mounted && createPortal(<MobileDrawer open={open} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

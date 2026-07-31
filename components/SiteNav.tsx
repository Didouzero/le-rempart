"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARTICLE_CATEGORIES, CATEGORY_META } from "@/lib/categories";

const homeLink = { href: "/", label: "Dernières news" } as const;

const rubriqueLinks = ARTICLE_CATEGORIES.map((key) => ({
  href: `/rubriques/${CATEGORY_META[key].slug}`,
  label: CATEGORY_META[key].short,
}));

const utilityLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/nous-soutenir", label: "Nous soutenir" },
] as const;

function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo-wordmark.png"
      alt="Le Rempart"
      width={791}
      height={127}
      className={`h-auto w-[9.5rem] ${className}`}
      priority
    />
  );
}

function DesktopNav({ ariaLabel }: { ariaLabel: string }) {
  const pathname = usePathname() || "/";

  return (
    <nav
      className="mx-auto hidden w-full max-w-6xl items-center justify-center gap-x-5 px-4 py-4 lg:flex lg:px-6"
      aria-label={ariaLabel}
    >
      {/* Accueil — encadré comme Contact / Nous soutenir + live-dot */}
      <Link
        href={homeLink.href}
        className="group font-display inline-flex shrink-0 items-center gap-2.5 border border-accent/45 px-3 py-1.5 text-[1.05rem] tracking-[0.12em] text-accent no-underline transition hover:border-accent hover:bg-accent hover:text-ink hover:no-underline"
      >
        <span
          className="live-dot shrink-0 group-hover:!bg-ink group-hover:!shadow-none"
          aria-hidden
        />
        {homeLink.label}
      </Link>

      <span
        className="h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-accent/70 to-transparent"
        aria-hidden
      />

      {/* Rubriques info — un même bloc */}
      <div
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-sm border border-white/15 bg-white/[0.04] px-4 py-2"
        role="group"
        aria-label="Rubriques"
      >
        {rubriqueLinks.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`font-display text-[1.22rem] tracking-[0.12em] transition-colors hover:text-accent ${
                active
                  ? "text-accent underline decoration-accent decoration-2 underline-offset-4"
                  : "text-white/90 no-underline hover:no-underline"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <span
        className="h-5 w-px shrink-0 bg-gradient-to-b from-transparent via-white/25 to-transparent"
        aria-hidden
      />

      {/* Pages utilitaires — style distinct */}
      <div
        className="flex items-center gap-3"
        role="group"
        aria-label="Contact et soutien"
      >
        {utilityLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-display border border-accent/45 px-3 py-1.5 text-[0.8rem] tracking-[0.14em] text-accent no-underline transition hover:border-accent hover:bg-accent hover:text-ink hover:no-underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
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

function MenuButton({
  open,
  onToggle,
  className = "",
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 w-11 items-center justify-center border border-white/25 text-white transition-colors duration-300 hover:border-accent/60 ${className}`}
      aria-expanded={open}
      aria-controls="mobile-nav-drawer"
      aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
      onClick={onToggle}
    >
      <HamburgerIcon open={open} />
    </button>
  );
}

export function SiteNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastY = useRef(0);

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

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      const pastHero = y > 140;

      if (!pastHero) {
        setStickyVisible(false);
      } else if (delta < -8) {
        setStickyVisible(true);
      } else if (delta > 8) {
        setStickyVisible(false);
      }

      lastY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  const chrome =
    mounted &&
    createPortal(
      <>
        <div
          style={{ zIndex: 10040 }}
          className={`fixed inset-x-0 top-0 border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out ${
            stickyVisible && !open
              ? "translate-y-0"
              : "pointer-events-none -translate-y-full"
          }`}
        >
          <div className="marble-band text-paper">
            <DesktopNav ariaLabel="Navigation sticky" />
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-2.5 lg:hidden">
              <Link
                href="/"
                className="inline-flex items-center no-underline hover:no-underline"
                aria-label="Le Rempart"
              >
                <BrandWordmark className="w-[8.5rem]" />
              </Link>
              <MenuButton open={open} onToggle={toggle} className="h-10 w-10" />
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-80" />
          </div>
        </div>

        <div
          id="mobile-nav-drawer"
          style={{ zIndex: 10060 }}
          className={`fixed inset-0 lg:hidden ${
            open ? "pointer-events-auto" : "pointer-events-none"
          }`}
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
            onClick={close}
          />
          <div
            className={`absolute inset-y-0 right-0 flex w-[min(100%,22rem)] flex-col bg-ink px-6 py-8 shadow-[-12px_0_40px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out ${
              open ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="mb-10 flex items-center justify-between gap-3">
              <BrandWordmark className="w-[10rem]" />
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                className="font-display shrink-0 text-sm tracking-[0.14em] text-white/80 transition-colors hover:text-accent"
                onClick={close}
              >
                Fermer
              </button>
            </div>
            <nav
              className="flex flex-col gap-6 text-white"
              aria-label="Navigation mobile"
              style={{ color: "#fff" }}
            >
              <Link
                href={homeLink.href}
                tabIndex={open ? 0 : -1}
                className="font-display inline-flex w-fit items-center gap-2.5 border border-accent/50 px-3 py-2 text-lg tracking-[0.12em] text-accent no-underline transition-all duration-300 hover:border-accent hover:bg-accent hover:text-ink"
                style={{
                  transitionDelay: open ? "80ms" : "0ms",
                  opacity: open ? 1 : 0,
                  transform: open ? "translateX(0)" : "translateX(0.75rem)",
                }}
                onClick={close}
              >
                <span className="live-dot shrink-0" aria-hidden />
                {homeLink.label}
              </Link>

              <div className="border-t border-white/15 pt-5">
                <p className="font-display mb-3 text-[0.7rem] tracking-[0.16em] text-white/45">
                  Rubriques
                </p>
                <div className="flex flex-col gap-4">
                  {rubriqueLinks.map((link, i) => {
                    const active =
                      pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        tabIndex={open ? 0 : -1}
                        aria-current={active ? "page" : undefined}
                        className={`font-display text-xl tracking-[0.12em] no-underline transition-all duration-300 hover:text-accent ${
                          active
                            ? "text-accent underline decoration-accent decoration-2 underline-offset-4"
                            : "text-white"
                        }`}
                        style={{
                          color: active ? undefined : "#fff",
                          transitionDelay: open ? `${120 + i * 35}ms` : "0ms",
                          opacity: open ? 1 : 0,
                          transform: open
                            ? "translateX(0)"
                            : "translateX(0.75rem)",
                        }}
                        onClick={close}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/15 pt-5">
                <div className="flex flex-col gap-3">
                  {utilityLinks.map((link, i) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      tabIndex={open ? 0 : -1}
                      className="font-display inline-flex w-fit border border-accent/50 px-3 py-2 text-sm tracking-[0.14em] text-accent no-underline transition hover:border-accent hover:bg-accent hover:text-ink"
                      style={{
                        transitionDelay: open ? `${280 + i * 40}ms` : "0ms",
                        opacity: open ? 1 : 0,
                        transform: open
                          ? "translateX(0)"
                          : "translateX(0.75rem)",
                      }}
                      onClick={close}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      <DesktopNav ariaLabel="Navigation principale" />

      <div className="mx-auto flex w-full max-w-6xl items-center justify-end px-4 py-3 lg:hidden">
        <MenuButton open={open} onToggle={toggle} />
      </div>

      {chrome}
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARTICLE_CATEGORIES, CATEGORY_META } from "@/lib/categories";

const navLinkClass =
  "font-display text-[0.935rem] tracking-[0.14em] text-white/90 no-underline transition-colors hover:text-accent hover:no-underline";

const links = [
  { href: "/", label: "Actualités" },
  ...ARTICLE_CATEGORIES.map((key) => ({
    href: `/rubriques/${CATEGORY_META[key].slug}`,
    label: CATEGORY_META[key].short,
  })),
  { href: "/contact", label: "Contact" },
  { href: "/nous-soutenir", label: "Soutenir" },
];

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
        {/* Mega menu sticky — au-dessus des images / contenu */}
        <div
          style={{ zIndex: 10040 }}
          className={`fixed inset-x-0 top-0 border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out ${
            stickyVisible && !open
              ? "translate-y-0"
              : "pointer-events-none -translate-y-full"
          }`}
        >
          <div className="marble-band text-paper">
            <nav
              className="mx-auto hidden w-full max-w-6xl items-center justify-center gap-x-7 gap-y-2 px-4 py-3.5 lg:flex lg:px-6"
              aria-label="Navigation sticky"
            >
              {links.map((link) => (
                <Link key={link.href} href={link.href} className={navLinkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-2.5 lg:hidden">
              <Link
                href="/"
                className="font-display text-[0.95rem] tracking-[0.16em] text-accent no-underline hover:no-underline"
              >
                Le Rempart
              </Link>
              <MenuButton open={open} onToggle={toggle} className="h-10 w-10" />
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-80" />
          </div>
        </div>

        {/* Drawer mobile */}
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
            <div className="mb-10 flex items-center justify-between">
              <p className="font-display text-lg tracking-[0.16em] text-accent">
                Le Rempart
              </p>
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                className="font-display text-sm tracking-[0.14em] text-white/80 transition-colors hover:text-accent"
                onClick={close}
              >
                Fermer
              </button>
            </div>
            <nav className="flex flex-col gap-5" aria-label="Navigation mobile">
              {links.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  tabIndex={open ? 0 : -1}
                  className={`font-display text-2xl tracking-[0.12em] text-white no-underline transition-all duration-300 hover:text-accent ${
                    open
                      ? "translate-x-0 opacity-100"
                      : "translate-x-3 opacity-0"
                  }`}
                  style={{
                    transitionDelay: open ? `${80 + i * 40}ms` : "0ms",
                  }}
                  onClick={close}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      {/* Desktop : menu centré */}
      <nav
        className="mx-auto hidden w-full max-w-6xl items-center justify-center gap-x-7 gap-y-2 px-4 py-4 lg:flex lg:px-6"
        aria-label="Navigation principale"
      >
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={navLinkClass}>
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Mobile / tablette : hamburger en tête de page */}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end px-4 py-3 lg:hidden">
        <MenuButton open={open} onToggle={toggle} />
      </div>

      {chrome}
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

      {/* Mobile / tablette : barre + hamburger */}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 lg:hidden">
        <span className="font-display text-[0.95rem] tracking-[0.16em] text-accent">
          Menu
        </span>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center border border-white/25 text-white"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Fermer" : "Menu"}</span>
          <span className="relative block h-4 w-5" aria-hidden>
            <span
              className={`absolute left-0 block h-[2px] w-full bg-accent transition ${open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"}`}
            />
            <span
              className={`absolute left-0 top-1/2 block h-[2px] w-full -translate-y-1/2 bg-accent transition ${open ? "opacity-0" : ""}`}
            />
            <span
              className={`absolute left-0 block h-[2px] w-full bg-accent transition ${open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"}`}
            />
          </span>
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="fixed inset-0 z-50 bg-ink/95 px-6 py-8 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="mb-8 flex items-center justify-between">
            <p className="font-display text-lg tracking-[0.16em] text-accent">
              Le Rempart
            </p>
            <button
              type="button"
              className="font-display text-sm tracking-[0.14em] text-white"
              onClick={() => setOpen(false)}
            >
              Fermer ✕
            </button>
          </div>
          <nav className="flex flex-col gap-5" aria-label="Navigation mobile">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-display text-2xl tracking-[0.12em] text-white no-underline hover:text-accent"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}

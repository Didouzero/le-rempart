"use client";

import Link from "next/link";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import { usePlus } from "@/components/PlusProvider";

const links = [
  { href: "/qui-sommes-nous", label: "Qui sommes-nous" },
  { href: "/s-abonner", label: "Rempart+", plusHref: "/rubriques/enquetes" },
  { href: "/connexion", label: "Connexion", hideForPlus: true },
  { href: "/contact", label: "Nous contacter" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "CGU" },
  { href: "/cgv", label: "CGV" },
  { href: "/resilier", label: "Résilier Rempart+" },
  { href: "/suppression-donnees", label: "Suppression des données" },
] as const;

export function FooterLinks() {
  const isPlus = usePlus();
  return (
    <nav
      className="flex flex-wrap gap-x-4 gap-y-2"
      aria-label="Liens du pied de page"
    >
      {links
        .filter((link) => !(isPlus && "hideForPlus" in link))
        .map((link) => (
          <Link
            key={link.href}
            href={isPlus && "plusHref" in link ? link.plusHref : link.href}
            className="text-white/75 no-underline underline-offset-4 hover:text-accent hover:underline"
          >
            {link.label}
          </Link>
        ))}
      <CookieSettingsButton />
    </nav>
  );
}

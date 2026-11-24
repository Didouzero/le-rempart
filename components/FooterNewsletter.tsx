"use client";

import { usePathname } from "next/navigation";
import { NewsletterSignup } from "@/components/NewsletterSignup";

/** Bandeau newsletter du pied de page, sauf sur les articles : ils la proposent déjà à la fin du texte. */
export function FooterNewsletter() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/articles/")) return null;
  return <NewsletterSignup source="footer-bar" variant="footer" />;
}

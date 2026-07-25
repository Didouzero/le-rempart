import Link from "next/link";

const links = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "CGU" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-ink bg-ink text-white">
      <div className="h-[3px] w-full bg-gradient-to-r from-accent via-accent-deep to-transparent" />
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 text-sm text-white/70 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-2xl tracking-[0.12em] text-white">
              Le Rempart
            </p>
            <p className="mt-1 font-display text-sm tracking-[0.14em] text-accent">
              Le média de droite radicale
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2"
            aria-label="Liens légaux"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/75 no-underline underline-offset-4 hover:text-accent hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-white/50">
          © {new Date().getFullYear()} Le Rempart — le-rempart.org. Site
          d&apos;information. Les contenus n&apos;engagent que leurs auteurs.
          Droit de réponse : contact@le-rempart.org
        </p>
      </div>
    </footer>
  );
}

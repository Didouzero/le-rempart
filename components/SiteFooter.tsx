import Link from "next/link";

const links = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "CGU" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Le Rempart — le-rempart.org</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Liens légaux">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="underline-offset-4 hover:text-ink hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted/90">
          Site d&apos;information. Les contenus n&apos;engagent que leurs auteurs.
          Droit de réponse : contact@le-rempart.org
        </p>
      </div>
    </footer>
  );
}

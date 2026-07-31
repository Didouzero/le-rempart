import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/contact", label: "Nous contacter" },
  { href: "/nous-soutenir", label: "Nous soutenir" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/cgu", label: "CGU" },
  { href: "/suppression-donnees", label: "Suppression des données" },
] as const;

const FACEBOOK_PAGE_URL =
  process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL?.trim() ||
  "https://www.facebook.com/934711579721830";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
    >
      <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.4-3.69 3.56-3.69 1.03 0 2.11.19 2.11.19v2.33h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.91h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-ink bg-ink text-white">
      <div className="h-[3px] w-full bg-gradient-to-r from-accent via-accent-deep to-transparent" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-white/70 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image
              src="/logo-wordmark.png"
              alt="Le Rempart"
              width={791}
              height={127}
              className="h-auto w-[11rem] sm:w-[13rem]"
            />
            <p className="font-tagline mt-2 text-sm text-white">
              Le média de droite radicale
            </p>
          </div>
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-fit items-center gap-3 rounded-sm border border-accent/50 bg-[#1877F2] px-4 py-2.5 text-white no-underline shadow-[0_8px_24px_rgba(24,119,242,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-[#166FE5] hover:no-underline hover:shadow-[0_12px_28px_rgba(24,119,242,0.45)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1877F2]">
              <FacebookIcon className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[0.95rem] tracking-[0.12em]">
                Suivre sur Facebook
              </span>
              <span className="text-xs text-white/85">
                Rejoignez la page Le Rempart
              </span>
            </span>
          </a>
        </div>
        <nav
          className="flex flex-wrap gap-x-4 gap-y-2"
          aria-label="Liens du pied de page"
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
        <p className="max-w-3xl text-xs leading-relaxed text-white/50">
          © {new Date().getFullYear()} Le Rempart — le-rempart.org. Site
          d&apos;information. Les contenus n&apos;engagent que leurs auteurs.
          Droit de réponse : contact@le-rempart.org
        </p>
      </div>
    </footer>
  );
}

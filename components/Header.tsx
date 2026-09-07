import Image from "next/image";
import Link from "next/link";
import { CrownCircleIcon, LoginCircleIcon } from "@/components/BrandIcons";
import { SiteNav } from "@/components/SiteNav";

type HeaderProps = {
  compact?: boolean;
  isPlus?: boolean;
};

export function Header({ compact = false, isPlus = false }: HeaderProps) {
  return (
    <header className="marble-band text-paper">
      <SiteNav />

      <div
        className="hidden h-[2px] w-full bg-gradient-to-r from-transparent via-accent to-transparent lg:block"
        aria-hidden
      />

      {!compact && (
        <div className="relative mx-auto w-full max-w-6xl px-3 py-3 lg:px-6 lg:pb-8 lg:pt-7">
          <div className="flex w-full items-stretch gap-2 lg:absolute lg:right-6 lg:top-6 lg:w-[13.5rem] lg:flex-col lg:gap-1.5">
            <Link
              href="/s-abonner"
              className="group inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-accent/50 bg-accent px-2.5 py-2 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-deep hover:no-underline hover:shadow-[0_12px_28px_rgba(255,189,89,0.45)] lg:w-full lg:flex-none lg:gap-3 lg:px-4 lg:py-2.5"
            >
              <CrownCircleIcon className="h-7 w-7 lg:h-8 lg:w-8" />
              <span className="flex min-w-0 flex-col leading-none text-left">
                <span className="font-display text-[0.82rem] tracking-[0.12em] lg:text-[1.15rem] lg:tracking-[0.14em]">
                  S&apos;abonner
                </span>
                <span className="font-display mt-0.5 text-[0.82rem] tracking-[0.12em] lg:text-[1.15rem] lg:tracking-[0.14em]">
                  au Rempart+
                </span>
              </span>
            </Link>
            {isPlus ? null : (
              <Link
                href="/connexion"
                className="group inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-accent/50 bg-ink px-2.5 py-2 text-accent no-underline shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-ink hover:no-underline lg:w-full lg:flex-none lg:gap-3 lg:px-4 lg:py-2.5"
              >
                <LoginCircleIcon className="h-7 w-7 group-hover:bg-ink group-hover:text-accent lg:h-8 lg:w-8" />
                <span className="flex min-w-0 flex-col leading-none text-left">
                  <span className="font-display text-[0.82rem] tracking-[0.12em] lg:text-[1.15rem] lg:tracking-[0.14em]">
                    Se connecter
                  </span>
                  <span className="mt-0.5 text-[0.58rem] tracking-[0.08em] text-white/65 group-hover:text-ink/70 lg:text-xs">
                    Déjà abonné
                  </span>
                </span>
              </Link>
            )}
          </div>

          <div className="hidden flex-col items-center text-center lg:flex">
            <Link
              href="/"
              className="no-underline hover:no-underline"
              aria-label="Le Rempart"
            >
              <Image
                src="/logo.png"
                alt="Le Rempart"
                width={420}
                height={160}
                priority
                className="mx-auto h-auto w-[180px] md:w-[200px]"
              />
            </Link>
            <div className="animate-line-grow mx-auto mt-3 h-[3px] w-28 bg-accent" />
            <p className="font-tagline mx-auto mt-3 max-w-xl text-[0.8rem] text-white sm:text-[0.925rem]">
              Le média de droite radicale
            </p>
          </div>
        </div>
      )}
    </header>
  );
}

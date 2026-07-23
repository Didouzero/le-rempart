import Image from "next/image";
import Link from "next/link";

type HeaderProps = {
  compact?: boolean;
};

export function Header({ compact = false }: HeaderProps) {
  return (
    <header className="marble-band text-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="no-underline hover:no-underline"
          aria-label="Le Rempart — Accueil"
        >
          <Image
            src="/logo.png"
            alt="Le Rempart"
            width={280}
            height={108}
            priority
            className="h-auto w-[160px] sm:w-[200px] md:w-[240px]"
          />
        </Link>
        <nav className="flex items-center gap-5 text-sm tracking-wide text-white/85">
          <Link href="/" className="hover:text-white">
            Actualités
          </Link>
        </nav>
      </div>
      {!compact && (
        <div className="border-t border-white/10">
          <div className="animate-fade-in mx-auto max-w-5xl px-4 py-8 text-center sm:px-6 sm:py-10">
            <p className="font-display text-3xl tracking-[0.12em] text-white sm:text-4xl">
              Le Rempart
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 sm:text-base">
              L&apos;actualité claire, factuelle, sans bruit.
            </p>
          </div>
        </div>
      )}
    </header>
  );
}

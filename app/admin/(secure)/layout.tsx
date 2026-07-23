import Link from "next/link";
import Image from "next/image";

export default function AdminSecureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="marble-band border-b border-black/40 text-paper">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/admin"
            className="flex items-center gap-3 no-underline hover:no-underline"
          >
            <Image
              src="/logo.png"
              alt="Le Rempart"
              width={140}
              height={56}
              className="h-auto w-[120px]"
            />
            <span className="hidden text-sm tracking-wide text-white/70 sm:inline">
              Administration
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/85">
            <Link href="/">Site</Link>
            <Link href="/admin">Articles</Link>
            <Link href="/admin/new">Nouveau</Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="cursor-pointer bg-transparent text-white/85 hover:text-white"
              >
                Déconnexion
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}

import { AdSlot } from "@/components/AdSlot";
import { BackToTop } from "@/components/BackToTop";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell flex min-h-screen flex-col">
      <Header />
      <div className="mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-1 gap-0 xl:grid-cols-[180px_minmax(0,72rem)_180px] xl:gap-5 xl:px-4">
        <aside
          className="relative z-0 hidden xl:sticky xl:top-6 xl:block xl:self-start xl:py-12"
          aria-label="Publicité gauche"
        >
          <AdSlot
            slot="sidebar-left"
            className="my-0 min-h-[600px] flex-col"
          />
        </aside>

        <main className="relative z-0 mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 xl:max-w-none xl:px-2">
          {children}
        </main>

        <aside
          className="relative z-0 hidden xl:sticky xl:top-6 xl:block xl:self-start xl:py-12"
          aria-label="Publicité droite"
        >
          <AdSlot
            slot="sidebar-right"
            className="my-0 min-h-[600px] flex-col"
          />
        </aside>
      </div>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}

import { AdSlot, adsEnabled } from "@/components/AdSlot";
import { BackToTop } from "@/components/BackToTop";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showAds = adsEnabled();

  return (
    <div className="site-shell flex min-h-screen flex-col">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <Header />
      <div
        className={`mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-1 gap-0 xl:px-4 ${
          showAds
            ? "xl:grid-cols-[180px_minmax(0,72rem)_180px] xl:gap-5"
            : "xl:max-w-6xl"
        }`}
      >
        {showAds ? (
          <aside
            className="hidden xl:sticky xl:top-6 xl:block xl:self-start xl:py-12"
            aria-label="Publicité gauche"
          >
            <AdSlot
              slot="sidebar-left"
              className="my-0 min-h-[600px] flex-col"
            />
          </aside>
        ) : null}

        <main
          className={`mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 ${
            showAds ? "xl:max-w-none xl:px-2" : ""
          }`}
        >
          {children}
        </main>

        {showAds ? (
          <aside
            className="hidden xl:sticky xl:top-6 xl:block xl:self-start xl:py-12"
            aria-label="Publicité droite"
          >
            <AdSlot
              slot="sidebar-right"
              className="my-0 min-h-[600px] flex-col"
            />
          </aside>
        ) : null}
      </div>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}

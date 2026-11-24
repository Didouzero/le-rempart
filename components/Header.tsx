import { SiteNav } from "@/components/SiteNav";

/** En-tête compact et collant : une seule barre, sur ordinateur comme sur mobile. */
export function Header() {
  return (
    <header
      className="site-header marble-band sticky top-0 text-paper"
      style={{ zIndex: 10040, paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <SiteNav />
    </header>
  );
}

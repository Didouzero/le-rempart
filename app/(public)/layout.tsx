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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

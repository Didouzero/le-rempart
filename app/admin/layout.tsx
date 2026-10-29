import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // L'admin reste en thème clair, quel que soit le réglage du visiteur.
  return (
    <div data-theme="light" className="min-h-screen bg-paper text-ink">
      {children}
    </div>
  );
}

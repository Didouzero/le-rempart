import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Le Rempart",
    template: "%s — Le Rempart",
  },
  description: "L'actualité claire, factuelle, sans bruit.",
  metadataBase: new URL("https://le-rempart.org"),
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}

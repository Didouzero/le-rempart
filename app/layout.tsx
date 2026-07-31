import { Open_Sans, Source_Sans_3 } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || "GTM-M53Q8GGZ";
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-KBPQRRFPDC";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-open-sans",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Le Rempart — Actualité & analyses",
    template: "%s — Le Rempart",
  },
  description:
    "Actualité, enquêtes et analyses. Immigration, justice, économie, patrimoine — Le Rempart, média indépendant.",
  metadataBase: new URL("https://www.le-rempart.org"),
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Le Rempart",
    title: "Le Rempart — Actualité & analyses",
    description:
      "Actualité, enquêtes et analyses. Immigration, justice, économie, patrimoine — Le Rempart, média indépendant.",
    url: "https://www.le-rempart.org",
    images: [
      {
        url: "/logo-wordmark.png",
        width: 791,
        height: 127,
        alt: "Le Rempart",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Le Rempart — Actualité & analyses",
    description:
      "Actualité, enquêtes et analyses. Le Rempart, média indépendant.",
    images: ["/logo-wordmark.png"],
  },
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
    <html lang="fr" className={`${openSans.variable} ${sourceSans.variable}`}>
      <body className="antialiased">
        {/* Google Tag Manager (noscript) — juste après <body> */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        {/* Google Tag Manager */}
        <Script id="gtm" strategy="beforeInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
        {/* Google Analytics 4 — une seule balise gtag par page */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-config" strategy="afterInteractive">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
`}</Script>
        {children}
      </body>
    </html>
  );
}

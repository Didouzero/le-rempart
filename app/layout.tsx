import { Open_Sans, Source_Sans_3 } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
import {
  SITE_DEFAULT_TITLE,
  SITE_DESCRIPTION,
  SITE_LOGO_SQUARE,
  SITE_LOGO_WORDMARK,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
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
    default: SITE_DEFAULT_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Rédaction Le Rempart", url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "news",
  metadataBase: new URL(SITE_URL),
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
    siteName: SITE_NAME,
    title: SITE_DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: SITE_LOGO_WORDMARK,
        width: 791,
        height: 127,
        alt: SITE_NAME,
      },
      {
        url: SITE_LOGO_SQUARE,
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_LOGO_WORDMARK],
  },
  icons: {
    icon: [{ url: SITE_LOGO_SQUARE, type: "image/png", sizes: "512x512" }],
    apple: [{ url: SITE_LOGO_SQUARE, sizes: "512x512", type: "image/png" }],
    shortcut: SITE_LOGO_SQUARE,
  },
  other: {
    "msapplication-TileColor": "#0c0a09",
    "msapplication-TileImage": SITE_LOGO_SQUARE,
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

import { Barlow_Condensed, Open_Sans, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
import {
  SITE_DEFAULT_TITLE,
  SITE_DESCRIPTION,
  SITE_LOGO_SQUARE,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_SIZE,
  SITE_URL,
} from "@/lib/seo";
import { SITE_AUTHOR } from "@/lib/authors";
import { CONSENT_DEFAULT_SCRIPT } from "@/lib/consent";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { rssAlternateTypes } from "@/lib/rss-links";
import "./globals.css";

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-KBPQRRFPDC";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-open-sans",
  display: "swap",
});

// Libellés, navigation, rubriques : condensée en capitales, chargée par le site
// (Impact n'existe pas sur Android).
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-condensed",
  display: "swap",
});

// Titres d'articles : serif de presse, en minuscules.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif",
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
  authors: [{ name: SITE_AUTHOR.name, url: `${SITE_URL}${SITE_AUTHOR.path}` }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "news",
  // Propriété Search Console validée par balise meta (plus par Tag Manager, retiré car vide).
  verification: { google: "oRtHNMr9Sd1B8Mqjuy7-RabRaMtQGaftMXQP3IqjY_w" },
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/", types: rssAlternateTypes() },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
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
    images: [{ url: SITE_OG_IMAGE, ...SITE_OG_IMAGE_SIZE, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  // Favicons en multiples de 48 px (exigence Google pour l'icône dans les résultats),
  // icône iPhone sur fond sombre ; favicon.ico est servi par app/favicon.ico.
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icons/favicon-96.png", type: "image/png", sizes: "96x96" },
      { url: "/icons/favicon-144.png", type: "image/png", sizes: "144x144" },
      { url: "/icons/favicon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
    <html
      lang="fr"
      className={`${openSans.variable} ${sourceSans.variable} ${barlowCondensed.variable} ${sourceSerif.variable}`}
      // Mode nuit par défaut, sur tous les appareils ; THEME_INIT_SCRIPT applique
      // le choix mémorisé avant l'hydratation.
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        {/* Thème clair / sombre appliqué avant l'affichage : pas de flash blanc. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Consentement refusé par défaut, avant GA4 (Consent Mode v2). */}
        <script dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT_SCRIPT }} />
      </head>
      <body className="antialiased">
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

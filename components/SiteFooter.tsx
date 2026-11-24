import Image from "next/image";
import Link from "next/link";
import { FooterLinks } from "@/components/FooterLinks";
import { HideForPlus } from "@/components/PlusProvider";
import { CrownCircleIcon } from "@/components/BrandIcons";
import { GooglePreferredSource } from "@/components/GooglePreferredSource";
import { FooterNewsletter } from "@/components/FooterNewsletter";

/** Tracés Simple Icons (CC0), les mêmes que les boutons de partage. */
const SOCIAL_LINKS = [
  {
    href:
      process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL?.trim() ||
      "https://www.facebook.com/934711579721830",
    title: "Suivre sur Facebook",
    path: "M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.4-3.69 3.56-3.69 1.03 0 2.11.19 2.11.19v2.33h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.91h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93z",
  },
  {
    href: "https://www.instagram.com/le_rempart_media/",
    title: "Suivre sur Instagram",
    path: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  },
  {
    href: "https://x.com/rempart_media",
    title: "Suivre sur X",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
] as const;

function SocialIcon({ path }: { path: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d={path} />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer mt-0 bg-ink text-white">
      <div
        className="h-[2px] w-full bg-gradient-to-r from-transparent via-accent to-transparent"
        aria-hidden
      />
      <FooterNewsletter />
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-accent/65 to-transparent"
        aria-hidden
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-white/70 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          {/* Logo et slogan de même largeur, centrés l'un sous l'autre (comme dans l'en-tête). */}
          <div className="inline-flex w-fit flex-col items-center">
            <Image
              src="/logo-wordmark.png"
              alt="Le Rempart"
              width={791}
              height={127}
              className="h-auto w-[10.5rem] sm:w-[12.2rem]"
            />
            <p className="font-tagline mt-2 pl-[0.2em] text-[0.6rem] tracking-[0.2em] text-white/80 sm:text-[0.7rem]">
              Le média de droite assumé
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <GooglePreferredSource onDark />
            <div className="flex items-center gap-3">
              <span className="font-display text-[0.76rem] tracking-[0.12em] text-white">
                Suivez-nous
              </span>
              <ul className="flex items-center gap-2">
                {SOCIAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.title}
                      title={link.title}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition duration-300 hover:bg-white/10 hover:text-accent"
                    >
                      <SocialIcon path={link.path} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <HideForPlus>
              <Link
                href="/s-abonner"
                className="group inline-flex w-fit items-center gap-2 rounded-lg border border-accent/50 bg-accent px-3 py-2 text-ink no-underline shadow-[0_8px_24px_rgba(255,189,89,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-deep hover:no-underline hover:shadow-[0_12px_28px_rgba(255,189,89,0.45)]"
              >
                <CrownCircleIcon className="h-[1.6rem] w-[1.6rem]" />
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-[0.76rem] tracking-[0.12em]">
                    S&apos;abonner au Rempart+
                  </span>
                  <span className="text-[0.6rem] text-ink/70">
                    Enquêtes et brief du matin
                  </span>
                </span>
              </Link>
            </HideForPlus>
          </div>
        </div>
        <FooterLinks />
        <p className="max-w-3xl text-xs leading-relaxed text-white/50">
          © {new Date().getFullYear()} Le Rempart — le-rempart.org. Site
          d&apos;information. Les contenus n&apos;engagent que leurs auteurs.
          Droit de réponse : contact@le-rempart.org
        </p>
      </div>
    </footer>
  );
}

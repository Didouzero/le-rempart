/** URL publique courte d'un article. */
export function articlePublicPath(publicId: number): string {
  return `/articles/${publicId}`;
}

export function siteUrlBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
      .replace(/\/$/, "")
      .replace("://le-rempart.org", "://www.le-rempart.org");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(
      /^https?:\/\//,
      "",
    );
    return `https://${host}`.replace(
      "://le-rempart.org",
      "://www.le-rempart.org",
    );
  }
  return "https://www.le-rempart.org";
}

export function articlePublicUrl(publicId: number, base?: string): string {
  const origin = (base || siteUrlBase()).replace(/\/$/, "");
  return `${origin}${articlePublicPath(publicId)}`;
}

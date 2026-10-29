/**
 * Témoin lisible par le navigateur : « ce visiteur s'est connecté en Rempart+ ou en admin ».
 * Les pages publiques sont mises en cache pour tout le monde ; seul un visiteur porteur
 * de ce témoin interroge /api/plus/status pour masquer pubs et appels à s'abonner.
 */
export const PLUS_HINT_COOKIE = "rempart_plus_hint";

export function plusHintCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

const COOKIE_NAME = "le_rempart_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toHex(signature);
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  const signature = await hmacSign(payload, getSecret());
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  try {
    const expected = await hmacSign(payload, getSecret());
    if (expected.length !== signature.length) return false;

    let mismatch = 0;
    for (let i = 0; i < expected.length; i += 1) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (password.length !== expected.length) {
    // Still compare to avoid leaking length via timing in trivial cases
  }
  let mismatch = password.length === expected.length ? 0 : 1;
  const max = Math.max(password.length, expected.length);
  for (let i = 0; i < max; i += 1) {
    const a = password.charCodeAt(i) || 0;
    const b = expected.charCodeAt(i) || 0;
    mismatch |= a ^ b;
  }
  return mismatch === 0;
}

export const authCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  },
};

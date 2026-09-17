/** Postgres UTF-8 refuse le NUL (0x00) dans tout champ texte. */
export function utf8Text(input: unknown, maxLen?: number): string {
  let text = typeof input === "string" ? input : input == null ? "" : String(input);
  text = text.replace(/\u0000/g, "");
  if (typeof maxLen === "number") text = text.slice(0, maxLen);
  return text;
}

export function utf8TextOrNull(
  input: unknown,
  maxLen?: number,
): string | null {
  const text = utf8Text(input, maxLen).trim();
  return text ? text : null;
}

export function isPostgresUtf8Error(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /22021|invalid byte sequence|UTF8.*0x00/i.test(msg);
}

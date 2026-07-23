export function slugify(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || "article";
}

export function uniqueSlug(title: string, existing?: string[]): string {
  const base = slugify(title);
  if (!existing?.includes(base)) return base;

  let i = 2;
  while (existing.includes(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

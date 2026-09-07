/** Met les citations « … » en italique Markdown si absentes. */
export function italicizeCitations(markdown: string): string {
  return markdown.replace(/«\s*([^»]+?)\s*»/g, (full, quote, offset, src) => {
    const before = String(src).slice(Math.max(0, offset - 1), offset);
    const afterEnd = offset + full.length;
    const after = String(src).slice(afterEnd, afterEnd + 1);
    if (before === "*" && after === "*") return full;
    return `*« ${String(quote).trim()} »*`;
  });
}

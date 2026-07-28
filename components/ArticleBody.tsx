import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ArticleBodyProps = {
  content: string;
};

/**
 * Rend cliquables les URLs collées en brut.
 * Ne touche PAS aux liens Markdown déjà écrits : [texte](https://…).
 */
function autolinkBareUrls(markdown: string): string {
  return markdown.replace(
    // (?<!]\() : évite de casser ](https://…)
    /(^|[\s])(?<!]\()(https?:\/\/[^\s<>\[\]"']+)/gm,
    (_m, pre: string, url: string) => {
      const trimmed = url.replace(/[),.;:!?]+$/u, "");
      const trail = url.slice(trimmed.length);
      return `${pre}[${trimmed}](${trimmed})${trail}`;
    },
  );
}

export function ArticleBody({ content }: ArticleBodyProps) {
  const md = autolinkBareUrls(content);

  return (
    <div className="prose-article">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const external = Boolean(href && /^https?:\/\//i.test(href));
            return (
              <a
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

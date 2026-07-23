import ReactMarkdown from "react-markdown";

type ArticleBodyProps = {
  content: string;
};

export function ArticleBody({ content }: ArticleBodyProps) {
  return (
    <div className="prose-article">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

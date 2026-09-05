import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { NewsletterSignup } from "@/components/NewsletterSignup";

type ArticleBodyProps = {
  content: string;
  /** Insère le CTA newsletter au milieu du corps. */
  showNewsletterCta?: boolean;
};

/**
 * Rend cliquables les URLs collées en brut.
 * Ne touche PAS aux liens Markdown déjà écrits : [texte](https://…).
 */
function autolinkBareUrls(markdown: string): string {
  return markdown.replace(
    /(^|[\s])(?<!]\()(https?:\/\/[^\s<>\[\]"']+)/gm,
    (_m, pre: string, url: string) => {
      const trimmed = url.replace(/[),.;:!?]+$/u, "");
      const trail = url.slice(trimmed.length);
      return `${pre}[${trimmed}](${trimmed})${trail}`;
    },
  );
}

/** URL YouTube/Vimeo/X seule sur une ligne → marqueur [video](url) pour embed. */
function markStandaloneVideos(markdown: string): string {
  return markdown.replace(
    /^(https?:\/\/(?:www\.|m(?:obile)?\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=[\w-]+|embed\/[\w-]+|shorts\/[\w-]+)|youtu\.be\/[\w-]+|vimeo\.com\/\d+|x\.com\/[^\s]+\/status(?:es)?\/\d+|twitter\.com\/[^\s]+\/status(?:es)?\/\d+)[^\s]*)\s*$/gim,
    (_m, url: string) => `[video](${url.trim()})`,
  );
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      return u.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

function vimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    return u.pathname.split("/").filter((p) => /^\d+$/.test(p))[0] || null;
  } catch {
    return null;
  }
}

function xStatusId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (
      host !== "x.com" &&
      host !== "twitter.com" &&
      host !== "mobile.twitter.com" &&
      host !== "mobile.x.com"
    ) {
      return null;
    }
    const match = u.pathname.match(/\/(?:[^/]+\/)?status(?:es)?\/(\d+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

type EmbedInfo = {
  src: string;
  title: string;
  provider: "youtube" | "vimeo" | "x";
};

function embedFromHref(href?: string): EmbedInfo | null {
  if (!href) return null;
  const yt = youtubeId(href);
  if (yt) {
    return {
      src: `https://www.youtube-nocookie.com/embed/${yt}`,
      title: "Vidéo YouTube",
      provider: "youtube",
    };
  }
  const vim = vimeoId(href);
  if (vim) {
    return {
      src: `https://player.vimeo.com/video/${vim}`,
      title: "Vidéo Vimeo",
      provider: "vimeo",
    };
  }
  const xid = xStatusId(href);
  if (xid) {
    return {
      src: `https://platform.twitter.com/embed/Tweet.html?id=${xid}&dnt=true`,
      title: "Post X",
      provider: "x",
    };
  }
  return null;
}

function textOf(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textOf).join("");
  }
  return "";
}

function VideoEmbed({
  src,
  title,
  provider,
}: {
  src: string;
  title: string;
  provider: EmbedInfo["provider"];
}) {
  return (
    <div
      className={
        provider === "x" ? "video-embed video-embed--x" : "video-embed"
      }
    >
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

const mdComponents = {
  h1: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => {
    const label = textOf(children).trim().toLowerCase();
    const embed =
      (label === "video" || label === "vidéo") && href
        ? embedFromHref(href)
        : null;
    if (embed) {
      return (
        <VideoEmbed
          src={embed.src}
          title={embed.title}
          provider={embed.provider}
        />
      );
    }

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
};

function MarkdownChunk({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {source}
    </ReactMarkdown>
  );
}

/** Coupe le markdown en deux blocs (milieu ≈ 50 % des blocs). */
function splitMarkdownMid(markdown: string): [string, string] {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length < 4) {
    return [markdown, ""];
  }
  const mid = Math.max(2, Math.floor(blocks.length / 2));
  return [blocks.slice(0, mid).join("\n\n"), blocks.slice(mid).join("\n\n")];
}

export function ArticleBody({
  content,
  showNewsletterCta = true,
}: ArticleBodyProps) {
  const md = autolinkBareUrls(markStandaloneVideos(content));
  const [first, rest] = showNewsletterCta
    ? splitMarkdownMid(md)
    : [md, ""];

  return (
    <div className="prose-article">
      <MarkdownChunk source={first} />
      {showNewsletterCta ? <NewsletterSignup source="article-mid" /> : null}
      {rest ? <MarkdownChunk source={rest} /> : null}
    </div>
  );
}

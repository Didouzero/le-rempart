import type { ReactNode } from "react";

// L'adresse peut contenir une paire de parenthèses (fréquent sur Wikimedia Commons).
const CAPTION_LINK = /\[([^\]]+)\]\((https?:\/\/(?:[^()\s]|\([^()\s]*\))+)\)/g;

/** Légende sans balisage, pour l'attribut alt. */
export function captionText(source: string): string {
  return source.replace(CAPTION_LINK, "$1");
}

/** Légende d'illustration : texte simple, liens [texte](url) permis pour les crédits. */
export function Caption({ source }: { source: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of source.matchAll(CAPTION_LINK)) {
    parts.push(source.slice(last, m.index));
    parts.push(
      <a
        key={m.index}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {m[1]}
      </a>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(source.slice(last));
  return <>{parts}</>;
}

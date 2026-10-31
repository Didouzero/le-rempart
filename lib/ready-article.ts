/**
 * Article déjà rédigé, envoyé au bot à la place du sujet : le bot le publie tel quel.
 *
 * TITRE : …
 * CHAPO : …
 * A LIRE AUSSI : 123, 456      (facultatif)
 * FLASH :
 * …
 * ARTICLE :
 * …
 */

import { citedUrls, linkedArticleIds } from "@/lib/article-links";
import {
  articleIssues,
  finishArticle,
  finishFlash,
  wrongWeekdays,
} from "@/lib/brief-writer";
import { ARTICLE_LENGTH } from "@/lib/writing/constraints";

export type ReadyArticle = {
  title: string;
  excerpt: string;
  flash: string;
  content: string;
  readAlsoIds: number[];
};

export function looksLikeReadyArticle(text: string): boolean {
  return /^\s*TITRE\s*:/i.test(text);
}

/** Lève une erreur explicite : un texte incomplet ne doit jamais partir en sujet chez Kimi. */
export function parseReadyArticle(text: string): ReadyArticle {
  const m = text.match(
    /^\s*TITRE\s*:\s*(.+?)\s*\n+\s*CHAP[OÔ]\s*:\s*([\s\S]+?)\s*\n+(?:\s*A LIRE AUSSI\s*:\s*(.*?)\s*\n+)?\s*FLASH\s*:\s*\n([\s\S]+?)\n+\s*ARTICLE\s*:\s*\n([\s\S]+)$/i,
  );
  if (!m) {
    throw new Error(
      "Texte prêt incomplet : il faut, dans l'ordre, TITRE :, CHAPO :, FLASH : et ARTICLE :.",
    );
  }
  return {
    title: m[1]!.trim(),
    excerpt: m[2]!.trim(),
    readAlsoIds: (m[3] || "").match(/\d+/g)?.map(Number).slice(0, 2) ?? [],
    flash: m[4]!.trim(),
    content: m[5]!.trim(),
  };
}

/** Enquête : mêmes contrôles qu'un article, avec la longueur d'un dossier payant. */
export function finishReadyInvestigation(ready: ReadyArticle) {
  const done = finishReadyArticle(ready);
  const words = done.finished.content.split(/\s+/).filter(Boolean).length;
  const issues = [...done.issues];
  if (words < ARTICLE_LENGTH.investigationMinWords) {
    issues.push(
      `l'enquête fait ${words} mots, il en faut au moins ${ARTICLE_LENGTH.investigationMinWords}`,
    );
  }
  return { ...done, issues };
}

/** Mise en forme finale et contrôles, communs à la publication et au canal Claude. */
export function finishReadyArticle(ready: ReadyArticle) {
  const finished = finishArticle(ready, {
    external: new Set(citedUrls(ready.content)),
    internal: new Set(linkedArticleIds(ready.content)),
  });
  const flash = finishFlash(ready.flash);
  return {
    finished,
    flash,
    issues: [...articleIssues(finished), ...wrongWeekdays(flash)],
  };
}

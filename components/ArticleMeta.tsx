import Link from "next/link";
import {
  formatPublishedAtDate,
  formatPublishedAtTime,
  publishedAtIso,
} from "@/lib/format-published-at";
import { ShareButtons } from "@/components/ShareButtons";
import { SITE_AUTHOR } from "@/lib/authors";
import { tagPath } from "@/lib/tags";

/** « 23 novembre 2026 à 12h49 », dans une balise time lisible par les moteurs. */
function DateTime({ value }: { value: Date | null }) {
  const date = formatPublishedAtDate(value);
  if (!date) return null;
  const time = formatPublishedAtTime(value);
  return (
    <time dateTime={publishedAtIso(value)}>
      {date}
      {time ? ` à ${time}` : ""}
    </time>
  );
}

/** Temps de lecture à 230 mots par minute. */
export function readingMinutesOf(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

/** Mise à jour affichée seulement pour une vraie correction, au moins une heure après la publication. */
export function wasUpdated(publishedAt: Date | null, updatedAt: Date): boolean {
  return Boolean(publishedAt && updatedAt.getTime() - publishedAt.getTime() > 60 * 60 * 1000);
}

/** Signature commune aux articles et aux enquêtes : portrait, nom, dates, temps de lecture, partage. */
export function Byline({
  author,
  publishedAt,
  updatedAt,
  readingMinutes,
  shareUrl,
  shareTitle,
}: {
  author: string;
  publishedAt: Date | null;
  updatedAt: Date | null;
  readingMinutes: number;
  shareUrl: string;
  shareTitle: string;
}) {
  const isSiteAuthor = author === SITE_AUTHOR.name;
  return (
    <div className="mt-7 flex flex-col gap-4 border-y border-rule py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {isSiteAuthor && SITE_AUTHOR.photo ? (
          <Link href={SITE_AUTHOR.path} rel="author" className="shrink-0" aria-label={author}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SITE_AUTHOR.photo}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full border border-accent/60 object-cover"
            />
          </Link>
        ) : null}
        <div className="min-w-0 leading-snug">
          <p className="text-[0.95rem] text-ink">
            Par{" "}
            {isSiteAuthor ? (
              <Link
                href={SITE_AUTHOR.path}
                rel="author"
                className="font-semibold text-ink no-underline hover:text-gold hover:underline"
              >
                {author}
              </Link>
            ) : (
              <span className="font-semibold">{author}</span>
            )}
            {isSiteAuthor ? (
              <span className="text-muted">, {SITE_AUTHOR.jobTitle.toLowerCase()}</span>
            ) : null}
          </p>
          {/* Une ligne par information : rien ne se coupe au milieu d'une date. */}
          <p className="mt-0.5 text-[0.8rem] text-muted">
            <span className="inline-block whitespace-nowrap">
              Publié le <DateTime value={publishedAt} />
            </span>
            <span aria-hidden> · </span>
            <span className="inline-block whitespace-nowrap">{readingMinutes} min de lecture</span>
          </p>
          {updatedAt ? (
            <p className="text-[0.8rem] text-muted">
              <span className="inline-block whitespace-nowrap">
                Mis à jour le <DateTime value={updatedAt} />
              </span>
            </p>
          ) : null}
        </div>
      </div>
      <ShareButtons url={shareUrl} title={shareTitle} compact />
    </div>
  );
}

/** Classe des étiquettes de sujet, partout sur le site : tuile à bords arrondis. */
export const TAG_CHIP =
  "inline-flex items-center gap-2 rounded-lg border border-rule bg-card/60 px-3 py-1.5 text-[0.9rem] text-ink no-underline transition hover:border-accent hover:text-gold hover:no-underline";

export function TagChips({
  tags,
  label,
}: {
  tags: { slug: string; name: string }[];
  label: string;
}) {
  if (tags.length === 0) return null;
  return (
    <nav aria-label={label}>
      <p className="section-kicker mb-3">Sujets</p>
      <ul className="flex list-none flex-wrap gap-2 p-0">
        {tags.map((t) => (
          <li key={t.slug}>
            <Link href={tagPath(t.slug)} className={TAG_CHIP}>
              {t.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Encadré auteur de fin d'article et d'enquête. */
export function AuthorBox() {
  return (
    <aside
      aria-label="L'auteur"
      className="flex gap-4 rounded-lg border border-rule bg-card/60 p-5 sm:p-6"
    >
      {SITE_AUTHOR.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={SITE_AUTHOR.photo}
          alt={SITE_AUTHOR.name}
          width={72}
          height={72}
          className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border border-accent/60 object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <p className="font-display text-[0.8rem] tracking-[0.16em] text-gold">L&apos;auteur</p>
        <p className="font-headline mt-1 text-xl text-ink">{SITE_AUTHOR.name}</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{SITE_AUTHOR.bio}</p>
        <Link
          href={`${SITE_AUTHOR.path}#ses-articles`}
          rel="author"
          className="font-display mt-3 inline-flex items-center gap-1.5 text-[0.85rem] tracking-[0.12em] text-gold no-underline hover:underline"
        >
          Tous ses articles <span aria-hidden>→</span>
        </Link>
      </div>
    </aside>
  );
}

import {
  formatPublishedAtDate,
  formatPublishedAtTime,
  publishedAtIso,
} from "@/lib/format-published-at";

type PublishedAtProps = {
  value: Date | string | null;
  weekday?: boolean;
  year?: boolean;
  className?: string;
  empty?: string;
};

export function PublishedAt({
  value,
  weekday,
  year,
  className,
  empty = "",
}: PublishedAtProps) {
  const date = formatPublishedAtDate(value, { weekday, year });
  const time = formatPublishedAtTime(value);
  if (!date) {
    return empty ? <span className={className}>{empty}</span> : null;
  }
  const iso = publishedAtIso(value);

  return (
    <time dateTime={iso} className={className}>
      {date}
      {time ? (
        <>
          {" · "}
          <span className="normal-case tracking-normal">{time}</span>
        </>
      ) : null}
    </time>
  );
}

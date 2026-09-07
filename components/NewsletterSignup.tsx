"use client";

import { FormEvent, useState } from "react";

type NewsletterSignupProps = {
  source?: string;
  compact?: boolean;
};

export function NewsletterSignup({
  source = "article",
  compact = false,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Inscription impossible. Réessayez.");
        return;
      }
      setStatus("ok");
      setMessage("Inscription enregistrée. Bienvenue dans le brief du matin.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Erreur réseau. Réessayez.");
    }
  }

  return (
    <aside
      className={`newsletter-signup my-6 max-w-[42rem] border border-ink/15 bg-ink px-4 py-4 text-paper ${
        compact ? "my-5 py-3.5" : ""
      }`}
      aria-label="Newsletter Le Rempart"
    >
      <p className="font-display text-[0.7rem] tracking-[0.16em] text-accent">
        Newsletter gratuite
      </p>
      <p className="font-display mt-0.5 text-base tracking-[0.08em] sm:text-lg">
        S&apos;abonner gratuitement à la newsletter
      </p>
      <p className="mt-1.5 text-sm leading-snug text-white/80">
        Chaque matin, à 7 heures, les 10 infos essentielles des dernières 24
        heures à droite. 🗞️
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-3 flex flex-row items-stretch gap-2"
      >
        <label className="sr-only" htmlFor={`nl-${source}`}>
          Adresse e-mail
        </label>
        <input
          id={`nl-${source}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.fr"
          className="min-w-0 w-0 flex-[2] border border-white/20 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="font-display w-0 min-w-0 flex-1 bg-accent px-2 py-2 text-center text-[0.7rem] tracking-[0.1em] text-ink transition hover:bg-accent-deep disabled:opacity-60 sm:text-xs sm:tracking-[0.12em]"
        >
          {status === "loading" ? "…" : "S'abonner"}
        </button>
      </form>
      {message ? (
        <p
          className={`mt-2 text-sm ${
            status === "error" ? "text-red-300" : "text-accent"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </aside>
  );
}

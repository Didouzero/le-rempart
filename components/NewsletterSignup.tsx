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
      className={`my-10 border border-ink/15 bg-ink px-5 py-6 text-paper sm:px-7 sm:py-7 ${
        compact ? "my-6 py-5" : ""
      }`}
      aria-label="Newsletter Le Rempart"
    >
      <p className="font-display text-sm tracking-[0.16em] text-accent">
        Newsletter gratuite
      </p>
      <h2 className="font-display mt-2 text-xl tracking-[0.08em] sm:text-2xl">
        S&apos;abonner gratuitement à la newsletter
      </h2>
      <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
        Chaque matin à 7&nbsp;h : 10 infos essentielles des dernières 24&nbsp;h
        (immigration, politique, sécurité, justice…). Zéro spam.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-stretch"
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
          className="min-w-0 flex-1 border border-white/20 bg-paper px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="font-display shrink-0 bg-accent px-5 py-2.5 text-sm tracking-[0.14em] text-ink transition hover:bg-accent-deep disabled:opacity-60"
        >
          {status === "loading" ? "…" : "S'abonner"}
        </button>
      </form>
      {message ? (
        <p
          className={`mt-3 text-sm ${
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

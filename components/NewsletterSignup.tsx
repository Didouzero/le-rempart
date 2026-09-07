"use client";

import { FormEvent, useState } from "react";

type NewsletterSignupProps = {
  source?: string;
  compact?: boolean;
  variant?: "default" | "footer";
};

export function NewsletterSignup({
  source = "article",
  compact = false,
  variant = "default",
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

  const form = (
    <form
      onSubmit={onSubmit}
      className={`flex flex-row items-stretch gap-2 ${
        variant === "footer" ? "w-full max-w-lg" : ""
      }`}
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
        className={
          variant === "footer"
            ? "min-w-0 flex-1 rounded-lg border border-white/20 bg-paper px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-accent"
            : "min-w-0 flex-[2] rounded-lg border border-white/20 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-accent"
        }
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={
          variant === "footer"
            ? "font-display shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm tracking-[0.12em] text-ink transition hover:bg-accent-deep disabled:opacity-60"
            : "font-display min-w-0 flex-1 rounded-lg bg-accent px-2 py-2 text-center text-[0.7rem] tracking-[0.1em] text-ink transition hover:bg-accent-deep disabled:opacity-60 sm:text-xs sm:tracking-[0.12em]"
        }
      >
        {status === "loading" ? "…" : "S'abonner"}
      </button>
    </form>
  );

  const statusLine = message ? (
    <p
      className={`text-sm ${
        status === "error" ? "text-red-300" : "text-accent"
      } ${variant === "footer" ? "mt-2" : "mt-2"}`}
      role="status"
    >
      {message}
    </p>
  ) : null;

  if (variant === "footer") {
    return (
      <aside className="bg-ink text-paper" aria-label="Newsletter Le Rempart">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6 sm:py-6">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[0.92rem] tracking-[0.16em] text-accent">
              Newsletter gratuite
            </p>
            <p className="mt-1 text-sm leading-snug text-white/80 sm:text-base">
              Chaque matin, à 7 heures, les 10 infos essentielles de droite des
              dernières 24 heures. 🗞️
            </p>
          </div>
          <div className="w-full min-w-0 sm:w-[min(100%,28rem)] sm:shrink-0">
            {form}
            {statusLine}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`newsletter-signup my-6 max-w-[42rem] border border-ink/15 bg-ink px-4 py-4 text-paper ${
        compact ? "my-5 py-3.5" : ""
      }`}
      aria-label="Newsletter Le Rempart"
    >
      <p className="font-display text-[0.92rem] tracking-[0.16em] text-accent">
        Rejoindre la newsletter gratuite
      </p>
      <p className="mt-1.5 text-sm leading-snug text-white/80">
        Chaque matin, à 7 heures, les 10 infos essentielles de droite des
        dernières 24 heures. 🗞️
      </p>
      <div className="mt-3">{form}</div>
      {statusLine}
    </aside>
  );
}

"use client";

import { FormEvent, useState } from "react";

export function NewsletterUnsubscribeForm() {
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
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Désabonnement impossible. Réessayez.");
        return;
      }
      setStatus("ok");
      setMessage("Vous êtes désabonné de la newsletter gratuite.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Erreur réseau. Réessayez.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex max-w-md flex-col gap-3">
      <label htmlFor="nl-unsub-email" className="text-sm text-muted">
        Votre e-mail
      </label>
      <input
        id="nl-unsub-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="votre@email.fr"
        className="rounded-lg border border-ink/15 bg-paper px-3 py-3 text-base outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="font-display rounded-lg bg-ink px-5 py-3 text-sm tracking-[0.14em] text-paper transition hover:bg-accent hover:text-ink disabled:opacity-60"
      >
        {status === "loading" ? "…" : "Me désabonner"}
      </button>
      {message ? (
        <p
          className={`text-sm ${status === "error" ? "text-red-700" : "text-ink"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { FormEvent, useState } from "react";

export function PlusLoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/plus/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Envoi impossible.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Erreur réseau.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <p className="mt-8 border border-ink/15 bg-white/50 px-4 py-4">
        Si cet e-mail correspond à un abonnement actif, le lien d’accès vient
        d’arriver. Pensez à regarder les spams.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex max-w-md flex-col gap-3">
      <label htmlFor="plus-login-email" className="text-sm text-muted">
        E-mail de l’abonnement
      </label>
      <input
        id="plus-login-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vous@email.fr"
        className="border border-ink/15 bg-paper px-3 py-3 text-base outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy}
        className="font-display bg-ink px-5 py-3 text-sm tracking-[0.14em] text-paper transition hover:bg-accent hover:text-ink disabled:opacity-60"
      >
        {busy ? "Envoi…" : "M’envoyer le lien"}
      </button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

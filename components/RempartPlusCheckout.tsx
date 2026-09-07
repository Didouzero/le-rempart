"use client";

import { FormEvent, useState } from "react";

type Props = {
  configured: boolean;
  publishableKey: string | null;
  status: "success" | "canceled" | null;
};

export function RempartPlusCheckout({ configured, status }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/subscribe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setError(data.error || "Impossible de démarrer le paiement.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Erreur réseau.");
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <p className="mt-6 rounded-lg border border-white/20 px-4 py-3 text-white/70">
        Paiement temporairement indisponible (Stripe non configuré).
      </p>
    );
  }

  return (
    <div className="mt-6">
      {status === "success" ? (
        <p className="mb-5 rounded-lg border border-accent/50 bg-accent/15 px-4 py-3 text-accent">
          Bienvenue. Votre accès Rempart+ est ouvert — direction les enquêtes.
        </p>
      ) : null}
      {status === "canceled" ? (
        <p className="mb-5 text-sm text-white/70">
          Paiement interrompu. Rien n’a été débité.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm text-white/70" htmlFor="plus-email">
          Votre e-mail d’accès
        </label>
        <input
          id="plus-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@email.fr"
          className="rounded-lg border border-white/20 bg-paper px-3 py-3 text-base text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="font-display rounded-lg bg-accent px-5 py-3.5 text-base tracking-[0.12em] text-ink transition hover:bg-accent-deep disabled:opacity-60"
        >
          {busy ? "Redirection…" : "Je m'abonne — 4,90 € / mois"}
        </button>
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

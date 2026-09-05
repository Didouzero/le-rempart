"use client";

import { FormEvent, useState } from "react";

type Props = {
  configured: boolean;
  publishableKey: string | null;
  status: "success" | "canceled" | null;
};

export function RempartPlusCheckout({
  configured,
  status,
}: Props) {
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
      <p className="mt-10 border border-ink/15 p-4 text-muted">
        Paiement temporairement indisponible (Stripe non configuré).
      </p>
    );
  }

  return (
    <div className="mt-10">
      {status === "success" ? (
        <p className="mb-6 border border-accent/40 bg-accent/15 px-4 py-3 text-ink">
          Merci — votre abonnement Rempart+ est en cours d&apos;activation.
          Vérifiez votre e-mail Stripe / confirmation.
        </p>
      ) : null}
      {status === "canceled" ? (
        <p className="mb-6 text-sm text-muted">Paiement annulé.</p>
      ) : null}

      <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
        <label className="text-sm text-muted" htmlFor="plus-email">
          E-mail de l&apos;abonnement
        </label>
        <input
          id="plus-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.fr"
          className="border border-ink/15 bg-paper px-3 py-2.5 text-base text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="font-display bg-ink px-5 py-3 text-sm tracking-[0.14em] text-paper transition hover:bg-accent hover:text-ink disabled:opacity-60"
        >
          {busy ? "Redirection…" : "S'abonner — 4,90 € / mois"}
        </button>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

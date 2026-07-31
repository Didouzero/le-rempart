"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  DONATION_AMOUNTS,
  type DonationAmount,
  type DonationMethod,
} from "@/lib/stripe";

const METHODS: Array<{
  id: DonationMethod;
  label: string;
  hint: string;
}> = [
  { id: "apple_pay", label: "Apple Pay", hint: "Paiement rapide Apple" },
  { id: "card", label: "Carte bancaire", hint: "Visa, Mastercard…" },
  { id: "paypal", label: "PayPal", hint: "Compte ou carte PayPal" },
];

function ApplePayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27 1.29-1.09.41-1.98-.41-2.82-1.62C4.25 17.99 2.93 13.45 4.7 10.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M7 15h4" />
    </svg>
  );
}

function PayPalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="currentColor">
      <path d="M9.5 20.5H7.2L8.7 11h2.3c1.9 0 3.3.3 4.1 1 .9.7 1.2 1.8 1 3.3-.3 2.1-1.6 3.5-3.7 4.1-.7.2-1.6.3-2.7.3H9.1l-.4 1.8h.8zm1.4-5.9h.6c.8 0 1.4-.1 1.8-.3.7-.3 1.1-.9 1.3-1.8.1-.6 0-1-.3-1.3-.3-.3-.9-.4-1.8-.4h-.7l-.9 3.8z" />
      <path d="M6.2 20.5H3.9L5.4 11h2.4c1.1 0 1.9.2 2.5.7.5.4.8 1.1.7 1.9 0 .2 0 .4-.1.6-.3 1.3-1.2 2.2-2.5 2.6-.6.2-1.3.3-2.2.3H5.5l-.5 2.4h1.2l-.5 2zm1.3-5.9h.7c.7 0 1.2-.1 1.5-.3.4-.2.7-.6.8-1.1.1-.4 0-.7-.2-.9-.2-.2-.7-.3-1.4-.3H7.9l-.4 2.6z" />
    </svg>
  );
}

function MethodIcon({ id }: { id: DonationMethod }) {
  if (id === "apple_pay") return <ApplePayIcon />;
  if (id === "paypal") return <PayPalIcon />;
  return <CardIcon />;
}

type DonateFormProps = {
  configured: boolean;
  status?: "success" | "canceled" | null;
};

export function DonateForm({ configured, status = null }: DonateFormProps) {
  const [amount, setAmount] = useState<DonationAmount>(5);
  const [method, setMethod] = useState<DonationMethod>("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctaLabel = useMemo(() => {
    if (loading) return "Redirection…";
    return `Faire un don de ${amount} €`;
  }, [amount, loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/donate/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Impossible de démarrer le paiement.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de paiement.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-10">
      {status === "success" ? (
        <p
          className="border border-accent/50 bg-accent/15 px-4 py-3 text-ink"
          role="status"
        >
          Merci. Votre don a bien été enregistré. Il soutient directement Le
          Rempart.
        </p>
      ) : null}
      {status === "canceled" ? (
        <p
          className="border border-rule bg-white/60 px-4 py-3 text-muted"
          role="status"
        >
          Paiement annulé. Vous pouvez réessayer quand vous voulez.
        </p>
      ) : null}

      <fieldset>
        <legend className="font-display text-sm tracking-[0.14em] text-ink">
          Choisir un montant
        </legend>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {DONATION_AMOUNTS.map((value) => {
            const active = amount === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                aria-pressed={active}
                className={`font-display min-h-16 border px-2 py-3 text-lg tracking-[0.08em] transition ${
                  active
                    ? "border-accent bg-accent text-ink shadow-[0_8px_24px_rgba(255,189,89,0.28)]"
                    : "border-rule bg-white/70 text-ink hover:border-accent/70 hover:bg-accent/10"
                }`}
              >
                {value}&nbsp;€
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-sm tracking-[0.14em] text-ink">
          Moyen de paiement
        </legend>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {METHODS.map((item) => {
            const active = method === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                aria-pressed={active}
                className={`flex items-center gap-3 border px-4 py-3 text-left transition ${
                  active
                    ? "border-accent bg-ink text-white"
                    : "border-rule bg-white/70 text-ink hover:border-accent/70"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${
                    active ? "bg-accent text-ink" : "bg-ink text-accent"
                  }`}
                >
                  <MethodIcon id={item.id} />
                </span>
                <span className="leading-tight">
                  <span className="font-display block text-[0.95rem] tracking-[0.1em]">
                    {item.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs ${
                      active ? "text-white/75" : "text-muted"
                    }`}
                  >
                    {item.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {method === "apple_pay" ? (
          <p className="mt-3 text-xs text-muted">
            Apple Pay s’affiche sur Checkout si votre appareil et le domaine
            sont compatibles ; sinon la carte bancaire reste disponible.
          </p>
        ) : null}
      </fieldset>

      {!configured ? (
        <p className="border border-rule bg-white/60 px-4 py-3 text-sm text-muted">
          Les paiements seront bientôt actifs. Les clés Stripe doivent encore
          être configurées.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!configured || loading}
        className="font-display inline-flex min-h-12 w-full items-center justify-center border border-accent bg-accent px-6 text-[1rem] tracking-[0.12em] text-ink transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {ctaLabel}
      </button>
    </form>
  );
}

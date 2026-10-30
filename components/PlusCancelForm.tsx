"use client";

import { FormEvent, useState } from "react";

type Props = {
  /** Abonné reconnu (session ou lien reçu par e-mail) : il ne reste qu'à confirmer. */
  email: string | null;
  token: string | null;
};

export function PlusCancelForm({ email, token }: Props) {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(url: string, body: object, okMessage?: string) {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Résiliation impossible. Réessayez.");
        return;
      }
      setStatus("ok");
      setMessage(okMessage || data.message || "");
    } catch {
      setStatus("error");
      setMessage("Erreur réseau. Réessayez.");
    }
  }

  function onRequest(e: FormEvent) {
    e.preventDefault();
    void submit(
      "/api/plus/cancel/request",
      { email: address },
      "Si un abonnement actif correspond à cette adresse, un lien de résiliation vient de vous être envoyé.",
    );
  }

  const feedback = message ? (
    <p
      className={`text-sm ${status === "error" ? "text-red-700" : "text-ink"}`}
      role="status"
    >
      {message}
    </p>
  ) : null;

  const buttonClass =
    "font-display rounded-lg bg-ink px-5 py-3 text-sm tracking-[0.14em] text-paper transition hover:bg-accent hover:text-ink disabled:opacity-60";

  if (email) {
    return (
      <div className="mt-8 flex max-w-md flex-col gap-3">
        {status === "ok" ? (
          <p className="text-sm text-ink" role="status">
            Votre résiliation est enregistrée. {message} Un e-mail de
            confirmation vous a été envoyé.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">Abonnement lié à : {email}</p>
            <button
              type="button"
              disabled={status === "loading"}
              className={buttonClass}
              onClick={() =>
                void submit("/api/plus/cancel", token ? { token } : {})
              }
            >
              {status === "loading" ? "…" : "Résilier mon abonnement"}
            </button>
            {feedback}
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onRequest} className="mt-8 flex max-w-md flex-col gap-3">
      <label htmlFor="plus-cancel-email" className="text-sm text-muted">
        L&apos;e-mail de votre abonnement
      </label>
      <input
        id="plus-cancel-email"
        type="email"
        required
        autoComplete="email"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="votre@email.fr"
        className="rounded-lg border border-ink/15 bg-paper px-3 py-3 text-base outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={buttonClass}
      >
        {status === "loading" ? "…" : "Recevoir le lien de résiliation"}
      </button>
      {feedback}
    </form>
  );
}

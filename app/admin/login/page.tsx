"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("Mot de passe incorrect.");
        setLoading(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError("Connexion impossible.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block no-underline hover:no-underline">
            <Image
              src="/logo.png"
              alt="Le Rempart"
              width={200}
              height={80}
              className="mx-auto h-auto w-[160px]"
              priority
            />
          </Link>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 border border-rule bg-white p-6"
        >
          <div>
            <h1 className="font-display text-3xl">Connexion</h1>
            <p className="mt-2 text-sm text-muted">Accès réservé à la rédaction.</p>
          </div>
          <label className="block text-sm font-semibold">
            Mot de passe
            <input
              type="password"
              className="admin-input mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="admin-btn w-full" disabled={loading}>
            {loading ? "Connexion…" : "Entrer"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Chargement…</p>}>
      <LoginForm />
    </Suspense>
  );
}

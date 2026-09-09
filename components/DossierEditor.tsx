"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DossierEditorProps = {
  dossierId: string;
  initial: {
    title: string;
    excerpt: string;
    content: string;
    coverImageUrl: string;
    membersOnly: boolean;
    published: boolean;
    slug: string;
  };
};

export function DossierEditor({ dossierId, initial }: DossierEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [content, setContent] = useState(initial.content);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);
  const [membersOnly, setMembersOnly] = useState(initial.membersOnly);
  const [published, setPublished] = useState(initial.published);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/dossiers/${dossierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          excerpt,
          content,
          coverImageUrl: coverImageUrl.trim() || null,
          membersOnly,
          published,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Enregistrement impossible");
      }
      setMessage("Enquête enregistrée.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Supprimer définitivement cette enquête ?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/dossiers/${dossierId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Suppression impossible");
      }
      router.replace("/admin/dossiers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-rule bg-white p-5">
      <p className="text-sm text-muted">
        Lien public :{" "}
        <a href={`/dossiers/${initial.slug}`} className="underline">
          /dossiers/{initial.slug}
        </a>
      </p>
      <label className="block text-sm font-semibold">
        Titre
        <input
          className="admin-input mt-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block text-sm font-semibold">
        Chapô
        <textarea
          className="admin-input mt-2 min-h-24"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />
      </label>
      <label className="block text-sm font-semibold">
        Contenu (Markdown — titres ##, tableaux, listes)
        <textarea
          className="admin-input mt-2 min-h-[32rem] font-mono text-[0.95rem] leading-relaxed"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      {coverImageUrl ? (
        <div className="overflow-hidden rounded-lg border border-rule bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageUrl}
            alt=""
            className="max-h-64 w-full object-cover"
          />
        </div>
      ) : null}
      <label className="block text-sm font-semibold">
        URL de l&apos;illustration
        <input
          className="admin-input mt-2"
          type="url"
          placeholder="https://…"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={membersOnly}
          onChange={(e) => setMembersOnly(e.target.checked)}
        />
        Réservé Rempart+
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        Publié
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-green-800">{message}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="admin-btn"
          disabled={saving || !title.trim() || !content.trim() || !excerpt.trim()}
          onClick={onSave}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-secondary ml-auto border-red-800 text-red-800"
          disabled={saving}
          onClick={onDelete}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ArticleEditorProps = {
  mode: "create" | "edit";
  articleId?: string;
  initial?: {
    title: string;
    excerpt: string;
    content: string;
    sourceText: string;
    sourceUrl: string;
    status: "draft" | "published";
  };
};

export function ArticleEditor({ mode, articleId, initial }: ArticleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [sourceText, setSourceText] = useState(initial?.sourceText ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status ?? "draft",
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onGenerate(event: FormEvent) {
    event.preventDefault();
    setGenerating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceText, sourceUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Génération impossible");
      }
      setTitle(data.title);
      setExcerpt(data.excerpt);
      setContent(data.content);
      setMessage("Article généré — relisez et éditez avant publication.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de génération");
    } finally {
      setGenerating(false);
    }
  }

  async function onSave(nextStatus: "draft" | "published") {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        title,
        excerpt,
        content,
        sourceText: sourceText || null,
        sourceUrl: sourceUrl || null,
        status: nextStatus,
      };

      const response = await fetch(
        mode === "edit" && articleId
          ? `/api/admin/articles/${articleId}`
          : "/api/admin/articles",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Enregistrement impossible");
      }

      setStatus(nextStatus);
      setMessage(
        nextStatus === "published"
          ? "Article publié."
          : "Brouillon enregistré.",
      );

      if (mode === "create") {
        router.replace(`/admin/articles/${data.id}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!articleId) return;
    if (!window.confirm("Supprimer définitivement cet article ?")) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/articles/${articleId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Suppression impossible");
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onGenerate} className="space-y-4 border border-rule bg-white p-5">
        <h2 className="font-display text-xl">Source</h2>
        <label className="block text-sm font-semibold">
          Titre
          <input
            className="admin-input mt-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Lien source (optionnel)
          <input
            className="admin-input mt-2"
            type="url"
            placeholder="https://"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Texte source / notes
          <textarea
            className="admin-input mt-2 min-h-36"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Collez ici le texte ou les notes à partir desquels Kimi rédigera l'article."
          />
        </label>
        <button
          type="submit"
          className="admin-btn"
          disabled={generating || !title.trim() || (!sourceText.trim() && !sourceUrl.trim())}
        >
          {generating ? "Génération…" : "Générer avec Kimi"}
        </button>
      </form>

      <div className="space-y-4 border border-rule bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Article</h2>
          <span className="text-sm capitalize text-muted">Statut : {status}</span>
        </div>
        <label className="block text-sm font-semibold">
          Titre
          <input
            className="admin-input mt-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Chapô / excerpt
          <textarea
            className="admin-input mt-2 min-h-20"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Contenu (Markdown)
          <textarea
            className="admin-input mt-2 min-h-80 font-mono text-[0.95rem] leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-green-800">{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={saving || !title.trim() || !content.trim()}
            onClick={() => onSave("draft")}
          >
            Enregistrer brouillon
          </button>
          <button
            type="button"
            className="admin-btn"
            disabled={saving || !title.trim() || !content.trim() || !excerpt.trim()}
            onClick={() => onSave("published")}
          >
            Publier
          </button>
          {mode === "edit" ? (
            <button
              type="button"
              className="admin-btn admin-btn-secondary ml-auto border-red-800 text-red-800"
              disabled={saving}
              onClick={onDelete}
            >
              Supprimer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

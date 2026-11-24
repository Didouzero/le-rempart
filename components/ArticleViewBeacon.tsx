"use client";

import { useEffect } from "react";

/** Compte une lecture de l'article, une seule fois par session de navigation. */
export function ArticleViewBeacon({ publicId }: { publicId: number }) {
  useEffect(() => {
    const key = `rempart-vu-${publicId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Navigation privée : on compte quand même.
    }
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: publicId }),
      keepalive: true,
    }).catch(() => {});
  }, [publicId]);
  return null;
}

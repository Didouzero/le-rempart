import { notFound } from "next/navigation";

/** Toute adresse inconnue passe par le gabarit public : la 404 garde en-tête et pied de page. */
export default function UnknownPage() {
  notFound();
}

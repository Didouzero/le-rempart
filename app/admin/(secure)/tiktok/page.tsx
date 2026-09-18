import Link from "next/link";
import {
  isTiktokAppConfigured,
  loadTiktokTokens,
  maskedTiktokClientKey,
  tiktokPostMode,
} from "@/lib/tiktok/publish";
import { tiktokRedirectUri, tiktokOauthScopes } from "@/lib/tiktok/oauth";

function oauthErrorLabel(code: string): string {
  const map: Record<string, string> = {
    ouvre_le_bouton_connecter:
      "N’ouvre pas l’URL /api/tiktok/oauth dans le navigateur. Reviens ici et clique « Connecter le compte TikTok ».",
    missing_params:
      "N’ouvre pas l’URL /api/tiktok/oauth dans le navigateur. Reviens ici et clique « Connecter le compte TikTok ».",
    config:
      "Clés TikTok absentes ou incomplètes sur Vercel (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET). Redeploy après les avoir ajoutées.",
    state:
      "La session OAuth a expiré ou le state ne correspond pas. Recolle la Redirect URI exacte dans TikTok, puis reclique Connecter.",
  };
  return map[code] || `Erreur OAuth : ${code}`;
}

export const dynamic = "force-dynamic";

export default async function AdminTiktokPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  const configured = isTiktokAppConfigured();
  const tokens = await loadTiktokTokens();
  const mode = tiktokPostMode();

  return (
    <div>
      <h1 className="font-display text-3xl">TikTok Droitocratie</h1>
      <p className="mt-2 text-sm text-muted">
        Relie le compte qui publiera les montages{" "}
        <code>/tiktok</code>. Tant que l’app TikTok n’est pas auditée, le mode{" "}
        <code>inbox</code> envoie un brouillon dans l’app.
      </p>

      {q.ok ? (
        <p className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-50 px-4 py-3 text-sm">
          Compte TikTok connecté.
        </p>
      ) : null}
      {q.error ? (
        <p className="mt-4 rounded-lg border border-red-700/40 bg-red-50 px-4 py-3 text-sm">
          {oauthErrorLabel(q.error)}
        </p>
      ) : null}

      <div className="mt-6 space-y-3 rounded-lg border border-rule bg-white px-4 py-5 text-sm">
        <p>
          App TikTok :{" "}
          <strong>{configured ? "clés présentes" : "TIKTOK_CLIENT_KEY / SECRET manquants"}</strong>
          {configured ? (
            <>
              {" "}
              (client_key {maskedTiktokClientKey()} — doit matcher le{" "}
              <strong>Sandbox</strong>, pas Production)
            </>
          ) : null}
        </p>
        <p>
          Compte :{" "}
          <strong>
            {tokens
              ? `relié (open_id ${tokens.openId.slice(0, 8)}…)`
              : "non relié"}
          </strong>
        </p>
        <p>
          Mode publication : <code>{mode}</code>
          {mode === "inbox"
            ? " — brouillon Inbox (recommandé avant audit)"
            : " — Direct Post public"}
        </p>
        <p>
          Redirect URI à coller dans TikTok for Developers (ne pas l’ouvrir
          soi-même) :{" "}
          <code className="break-all">{tiktokRedirectUri()}</code>
        </p>
        <p>
          Scopes envoyés à TikTok : <code>{tiktokOauthScopes()}</code>
        </p>
        <p>
          Pour <code>PULL_FROM_URL</code>, vérifie le préfixe{" "}
          <code>https://www.le-rempart.org/</code> (ou ton domaine) dans l’app
          TikTok.
        </p>
        <p className="text-muted">
          Si TikTok dit encore « client_key » alors que les 6 caractères
          matchent le Sandbox : dans le Sandbox clique{" "}
          <strong>Apply changes</strong>, Login Kit doit être en{" "}
          <strong>Web</strong> (pas seulement iOS), et le Target user doit
          apparaître dans la liste (parfois jusqu’à 1 h). Les variables Vercel
          doivent être cochées <strong>Production</strong>, pas seulement
          Preview.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {configured ? (
          <a href="/api/tiktok/oauth?start=1" className="admin-btn no-underline hover:no-underline">
            {tokens ? "Reconnecter le compte" : "Connecter le compte TikTok"}
          </a>
        ) : (
          <p className="text-sm text-muted">
            Ajoute les variables d’environnement puis recharge cette page.
          </p>
        )}
        {tokens ? (
          <form action="/api/tiktok/oauth" method="POST">
            <button type="submit" className="cursor-pointer text-sm underline">
              Déconnecter
            </button>
          </form>
        ) : null}
      </div>

      <p className="mt-8 text-sm text-muted">
        <Link href="/admin">← Articles</Link>
      </p>
    </div>
  );
}

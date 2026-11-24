import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Envoi e-mail via Resend (REST).
 * From : NEWSLETTER_FROM ou contact@le-rempart.org
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY manquant" };
  }

  const from =
    process.env.NEWSLETTER_FROM?.trim() ||
    `${SITE_NAME} <contact@le-rempart.org>`;

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("resend error", res.status, detail);
    let message = `Resend HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(detail) as {
        message?: string;
        name?: string;
      };
      if (parsed.message) {
        message = `${message}: ${parsed.message}`;
      } else if (detail) {
        message = `${message}: ${detail.slice(0, 240)}`;
      }
    } catch {
      if (detail) message = `${message}: ${detail.slice(0, 240)}`;
    }
    return { ok: false, error: message };
  }
  return { ok: true };
}

/**
 * Charte des e-mails, reprise du site en mode jour : titres en Source Serif, libellés en
 * Barlow Condensed, texte en Source Sans, doré en bronze sur fond clair, tuiles carrées à
 * bords arrondis, jamais de rond. Les polices web s'affichent dans Apple Mail et iOS ;
 * Gmail et Outlook prennent les polices de repli.
 */
export const EMAIL_FONTS = {
  serif: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  sans: "'Source Sans 3', 'Segoe UI', Helvetica, Arial, sans-serif",
  label: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
  tagline: "'Open Sans', Helvetica, Arial, sans-serif",
} as const;

export const EMAIL_COLORS = {
  ink: "#0a0a0a",
  paper: "#f4f2ed",
  card: "#ffffff",
  rule: "#ddd8cf",
  muted: "#5c574f",
  text: "#2a2a2a",
  gold: "#8f5f0c",
  accent: "#ffbd59",
} as const;

export function newsletterShell(opts: {
  title: string;
  bodyHtml: string;
  footerNote?: string;
  /** Masque le titre du shell (ex. brief avec en-tête graphique). */
  hideTitle?: boolean;
  /** Ajoute le lien de résiliation des abonnés Rempart+. */
  plusCancelLink?: boolean;
  /** Texte d'aperçu affiché par la messagerie sous l'objet. */
  preheader?: string;
}): string {
  const C = EMAIL_COLORS;
  const F = EMAIL_FONTS;
  const site = absoluteUrl("/") || SITE_URL;
  const plusCancel = opts.plusCancelLink
    ? ` · <a href="${absoluteUrl("/resilier")}" style="color:${C.muted};">Résilier Rempart+</a>`
    : "";
  const heading = opts.hideTitle
    ? ""
    : `<h1 style="margin:0 0 6px;font-family:${F.serif};font-size:26px;line-height:1.2;font-weight:700;color:${C.ink};">${opts.title}</h1>
    <div style="height:3px;width:64px;background:${C.accent};margin:12px 0 24px;"></div>`;
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${opts.preheader}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${opts.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600&family=Open+Sans:wght@500&family=Source+Sans+3:wght@400;600&family=Source+Serif+4:wght@600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.paper};color:${C.ink};font-family:${F.sans};">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${C.paper};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;">
    <tr>
      <td style="background:${C.ink};border-radius:8px 8px 0 0;padding:22px 24px 18px;text-align:center;">
        <a href="${site}" style="text-decoration:none;"><img src="${absoluteUrl("/logo-wordmark.png")}" width="180" alt="${SITE_NAME}" style="display:inline-block;width:180px;max-width:60%;height:auto;border:0;"></a>
        <p style="margin:8px 0 0;font-family:${F.tagline};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Le média de droite assumé</p>
      </td>
    </tr>
    <tr><td style="height:3px;background:${C.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="background:${C.card};border:1px solid ${C.rule};border-top:0;border-radius:0 0 8px 8px;padding:28px 24px 8px;">
        ${heading}
        ${opts.bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 8px 0;font-family:${F.sans};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
        ${opts.footerNote || `Vous recevez ce brief car vous êtes abonné à ${SITE_NAME}.`}
        <br><a href="${site}" style="color:${C.ink};">${site.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
        · <a href="${absoluteUrl("/newsletter/desabonnement")}" style="color:${C.muted};">Se désabonner</a>${plusCancel}
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

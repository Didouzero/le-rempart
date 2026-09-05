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
    return { ok: false, error: `Resend HTTP ${res.status}` };
  }
  return { ok: true };
}

export function newsletterShell(opts: {
  title: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const site = absoluteUrl("/") || SITE_URL;
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${opts.title}</title></head>
<body style="margin:0;background:#f4f2ed;color:#0a0a0a;font-family:Georgia,serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#5c574f;">${SITE_NAME}</p>
    <h1 style="font-size:22px;line-height:1.2;">${opts.title}</h1>
    <div style="height:3px;width:80px;background:#ffbd59;margin:12px 0 24px;"></div>
    ${opts.bodyHtml}
    <p style="margin-top:32px;font-size:12px;color:#5c574f;">
      ${opts.footerNote || `Vous recevez ce brief car vous êtes abonné à ${SITE_NAME}.`}
      <br/><a href="${site}" style="color:#0a0a0a;">${site.replace(/^https?:\/\//, "")}</a>
      · <a href="${absoluteUrl("/newsletter/desabonnement")}" style="color:#5c574f;">Se désabonner</a>
    </p>
  </div>
</body>
</html>`;
}

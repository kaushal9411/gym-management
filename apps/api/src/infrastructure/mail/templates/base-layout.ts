export interface EmailBranding {
  tenantName: string;
  primaryColor?: string;
  logoUrl?: string;
}

const DEFAULT_PRIMARY = '#4f46e5';

/**
 * Minimal inline-styled HTML shell — email clients don't reliably support
 * external stylesheets or Tailwind, so every rule is inlined. Tenant
 * branding (color + optional logo) is injected per send.
 */
export function renderEmailLayout(branding: EmailBranding, bodyHtml: string): string {
  const color = branding.primaryColor ?? DEFAULT_PRIMARY;
  const logo = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.tenantName}" style="height:40px;margin-bottom:16px" />`
    : `<div style="font-size:20px;font-weight:700;color:${color};margin-bottom:16px">${branding.tenantName}</div>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr><td>${logo}</td></tr>
            <tr><td style="color:#1f2937;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
            <tr>
              <td style="padding-top:24px;border-top:1px solid #e5e7eb;margin-top:24px;color:#9ca3af;font-size:12px;">
                Sent by ${branding.tenantName} via FitCloud. If you didn't expect this email, you can ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function actionButton(url: string, label: string, color = DEFAULT_PRIMARY): string {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:${color};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${label}</a>`;
}

export interface EmailBranding {
  tenantName: string;
  primaryColor?: string;
  logoUrl?: string;
}

export type HeroTone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface HeroOptions {
  /** Emoji shown above the title — plain, no icon badge/box around it. */
  icon: string;
  /** Bold headline under the icon. */
  title: string;
  /** Small label in the top-right of the header row ("Account Security", "Billing", …). */
  categoryLabel: string;
  /** Controls the accent color used for the icon, links, emphasized values, and status text. Defaults to the tenant's brand color. */
  tone?: HeroTone;
  preheader?: string;
}

const DEFAULT_PRIMARY = '#4f46e5';
const TONE_COLOR: Record<HeroTone, string | null> = {
  brand: null, // resolved from branding.primaryColor at render time
  success: '#16a34a',
  warning: '#b45309',
  danger: '#dc2626',
  info: '#2563eb',
};

function toneColor(branding: EmailBranding, tone: HeroTone = 'brand'): string {
  return TONE_COLOR[tone] ?? branding.primaryColor ?? DEFAULT_PRIMARY;
}

/**
 * Full HTML shell — every rule inlined (email clients don't reliably support
 * external stylesheets, and plenty strip <style> blocks entirely).
 *
 * Deliberately plain/"safe": white page, a simple plain-text header (logo +
 * tenant name + category label, no colored bar), an icon + headline with no
 * badge/box around it, body content directly on white, and a plain footer
 * separated only by a thin rule — no dark bands, no card shadow/box, no
 * tinted containers anywhere. Detail/richness comes from the content
 * (detailTable rows, tone-colored emphasis) rather than decorative chrome.
 */
export function renderEmailLayout(branding: EmailBranding, hero: HeroOptions, bodyHtml: string): string {
  const accent = toneColor(branding, hero.tone);

  const logoMark = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.tenantName}" style="height:26px;display:block;" />`
    : `<span style="font-size:19px;line-height:1;">🏋️</span>`;

  const preheader = hero.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${hero.preheader}${'&#8203;'.repeat(80)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${branding.tenantName}</title>
    <style>
      /* Mobile responsiveness — the content table is fluid by construction
         (width:100% + max-width:580px on the *style*, no fixed HTML width
         attribute) so every real mobile/modern client shrinks it to fit a
         narrow viewport with zero dependency on this @media block actually
         being honored (several major mail apps strip <style>/@media
         entirely; a fluid table still works there regardless). These rules
         are a progressive-enhancement layer on top: tighter padding,
         smaller type, a full-width button, and the category label hidden so
         nothing crowds a ~360-390px phone screen. '!important' is required
         — a style block only wins over the inline styles set below when
         marked important. */
      @media only screen and (max-width: 620px) {
        .fc-outer-pad { padding-left: 18px !important; padding-right: 18px !important; }
        .fc-title { font-size: 21px !important; }
        .fc-body-pad { font-size: 15px !important; }
        .fc-otp-digit { width: 32px !important; height: 44px !important; }
        .fc-otp-digit span { font-size: 19px !important; }
        .fc-btn-table { width: 100% !important; }
        .fc-btn-cell { display: block !important; width: 100% !important; text-align: center !important; }
        .fc-btn-link { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
        .fc-category-label { display: none !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;">
      <tr>
        <td align="center" class="fc-outer-pad" style="padding:44px 16px;">
          <!--[if mso]>
          <table role="presentation" width="580" cellpadding="0" cellspacing="0" align="center"><tr><td>
          <![endif]-->
          <!--
            Fluid by default (width:100% + max-width:580px on the *style*, no
            fixed HTML width attribute) so every real mobile/modern client —
            Gmail app, Apple Mail, Outlook.com, and Mailpit's own preview
            included — shrinks the table to fit a narrow viewport. Outlook
            DESKTOP is the one client that ignores max-width and reads a raw
            HTML width attribute — it gets its own fixed-580px table via the
            MSO conditional-comment wrapper above/below, invisible to every
            other client.
          -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;margin:0 auto;background:#ffffff;">

            <!-- Header: plain, no colored bar — logo/name left, category label right -->
            <tr>
              <td style="padding:4px 6px 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left" valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                        <td style="padding-right:9px;">${logoMark}</td>
                        <td style="font-size:15px;font-weight:800;color:#14151f;letter-spacing:-0.01em;">${branding.tenantName}</td>
                      </tr></table>
                    </td>
                    <td align="right" valign="middle" class="fc-category-label" style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9aa1ae;">${hero.categoryLabel}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="border-top:2px solid ${accent};font-size:0;line-height:0;">&nbsp;</td></tr>

            <!-- Title: plain icon + bold headline, no badge/box -->
            <tr>
              <td style="padding:30px 6px 2px;">
                <div style="font-size:32px;line-height:1;margin-bottom:12px;">${hero.icon}</div>
                <div class="fc-title" style="font-size:24px;line-height:1.3;font-weight:800;color:#14151f;letter-spacing:-0.02em;">${hero.title}</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td class="fc-body-pad" style="padding:18px 6px 4px;color:#333544;font-size:15.5px;line-height:1.7;">${bodyHtml}</td>
            </tr>

            <!-- Footer: plain, thin rule only, no dark band -->
            <tr><td style="padding-top:34px;">&nbsp;</td></tr>
            <tr><td style="border-top:1px solid #edeef4;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:20px 6px 4px;">
                <p style="margin:0;color:#9aa1ae;font-size:12.5px;line-height:1.7;">
                  Sent by <strong style="color:#6b7080;">${branding.tenantName}</strong>, powered by FitCloud.<br/>If you weren't expecting this email, you can safely ignore it.
                </p>
              </td>
            </tr>

          </table>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function actionButton(url: string, label: string, color = DEFAULT_PRIMARY): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" class="fc-btn-table" style="margin:26px 0 8px;">
  <tr>
    <td class="fc-btn-cell" style="border-radius:8px;background:${color};">
      <a href="${url}" class="fc-btn-link" style="display:inline-block;padding:13px 30px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.01em;border-radius:8px;">${label} →</a>
    </td>
  </tr>
</table>`;
}

/** Muted secondary link — for "or paste this link" fallbacks and other low-emphasis actions under a primary button. */
export function secondaryLink(url: string, label = url): string {
  return `<p style="margin:14px 0 0;font-size:12.5px;color:#9aa1ae;word-break:break-all;">${label !== url ? `${label}: ` : ''}<a href="${url}" style="color:#6b7280;">${url}</a></p>`;
}

/** Muted footnote — "need help? contact support" style closer, or an expiry/legal note. */
export function footnote(text: string): string {
  return `<p style="margin:22px 0 4px;font-size:13px;color:#9aa1ae;">${text}</p>`;
}

/** Left-accented callout — no filled background, just a thin colored rule, for anything that should read as emphasized without becoming a "box". */
export function infoBox(innerHtml: string, color = DEFAULT_PRIMARY): string {
  return `<div style="margin:20px 0;padding:2px 0 2px 14px;border-left:3px solid ${color};color:#333544;">${innerHtml}</div>`;
}

/** Large centered code/number display — verification codes, OTPs. Thin-bordered digit cells (unavoidably boxed — that's the standard OTP-entry affordance) but no tinted container behind them. */
export function codeBlock(code: string, color = DEFAULT_PRIMARY): string {
  const digits = code
    .split('')
    .map(
      (d) =>
        `<td class="fc-otp-digit" style="width:42px;height:52px;border:1px solid #e2e4ee;border-radius:8px;text-align:center;vertical-align:middle;"><span style="font-size:24px;font-weight:800;color:${color};font-family:'SF Mono',Consolas,Menlo,monospace;">${d}</span></td><td style="width:7px;">&nbsp;</td>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
  <tr>${digits}</tr>
</table>`;
}

/** One label/value row in a detail list — plain, divided by a thin rule only, no icon badge or container. `icon` is shown inline before the label. */
export function detailRow(icon: string, label: string, value: string, opts?: { emphasize?: boolean; color?: string }): string {
  const valueStyle = opts?.emphasize
    ? `font-weight:800;color:${opts.color ?? '#14151f'};font-size:15.5px;`
    : 'font-weight:700;color:#373a49;font-size:14px;';
  return `<tr>
  <td style="padding:11px 0;border-bottom:1px solid #edeef4;color:#8c8fa0;font-size:13.5px;font-weight:600;">${icon} ${label}</td>
  <td align="right" style="padding:11px 0;border-bottom:1px solid #edeef4;${valueStyle}">${value}</td>
</tr>`;
}

/** Wraps `detailRow`s into a plain divided list — the invoice/receipt/plan-summary "details" block, no card/border/background. */
export function detailTable(rowsHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-top:1px solid #edeef4;">${rowsHtml}</table>`;
}

/** Plain inline icon+label strip — e.g. "📋 Manage members · 💳 Track billing · 📈 Grow your gym" under a welcome message. Purely decorative reinforcement, not data. */
export function iconStrip(items: Array<{ icon: string; label: string }>): string {
  const text = items.map((item) => `${item.icon} ${item.label}`).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  return `<p style="margin:26px 0 4px;padding-top:18px;border-top:1px solid #edeef4;color:#6b7280;font-size:13px;font-weight:600;">${text}</p>`;
}

/** 2-up stat summary — plain value/label pairs side by side, no tinted card. */
export function statGrid(stats: Array<{ icon: string; label: string; value: string; color?: string }>): string {
  const cells = stats
    .map(
      (stat) => `<td width="50%" style="padding:10px 12px 10px 0;vertical-align:top;">
      <div style="font-size:20px;font-weight:800;color:#14151f;">${stat.value}</div>
      <div style="font-size:11.5px;font-weight:700;color:#8c8fa0;margin-top:2px;">${stat.icon} ${stat.label}</div>
    </td>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;border-top:1px solid #edeef4;padding-top:14px;"><tr>${cells}</tr></table>`;
}

/** Status indicator — colored bold text, no pill/background. */
export function statusBadge(label: string, tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral'): string {
  const color = { success: '#16a34a', warning: '#b45309', danger: '#dc2626', neutral: '#5c6474' }[tone];
  return `<span style="color:${color};font-weight:800;">${label}</span>`;
}

export function muted(text: string): string {
  return `<p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #edeef4;font-size:12.5px;color:#9aa1ae;line-height:1.7;">${text}</p>`;
}

/** Resolves the right accent color for a given tone against a tenant's own brand color — exported so callers building custom detail rows/info boxes can stay color-consistent without recomputing the tone map themselves. */
export function toneAccent(branding: EmailBranding, tone: HeroTone = 'brand'): string {
  return toneColor(branding, tone);
}

/** Currency amount formatted with the tenant's own symbol and en-IN digit grouping (e.g. `formatMoney(1234567, '₹')` → `₹12,34,567.00`) — reads naturally for INR and stays perfectly legible for any other currency's amounts. */
export function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

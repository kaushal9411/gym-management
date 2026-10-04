/**
 * Shared transactional-email shell + building blocks.
 *
 * RULES
 *  - Hand-written, table-based, every style inlined (Outlook/Gmail safe). A small `<style>` block adds
 *    responsive + dark-mode enhancements only; the email must look right with it stripped.
 *  - Every interpolated, user-controlled string MUST go through `escapeHtml()` (or a helper that
 *    documents it escapes). Helpers whose parameters are named `*Html` / `innerHtml` / `bodyHtml` / `value`
 *    (detailRow) take already-safe HTML — escape before passing.
 *  - No external images except the tenant logo.
 */

export interface EmailBranding {
  tenantName: string;
  /** Any CSS colour string the tenant stored (#hex, rgb(), oklch()). Unparseable values fall back to the FitCloud indigo. */
  primaryColor?: string;
  logoUrl?: string;
  /** Optional support address shown in the footer (only pass real data). */
  supportEmail?: string;
  /** Optional support phone shown in the sign-off (only pass real data). */
  supportPhone?: string;
  /** Platform-originated mail (FitCloud itself) rather than a gym's mail. */
  isPlatform?: boolean;
}

export type HeroTone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface HeroOptions {
  /** Emoji shown in the hero medallion. */
  icon: string;
  title: string;
  /** Category pill in the header band ("Account Security", "Billing", …). */
  categoryLabel: string;
  /** Accent for the medallion ring, links and emphasised values. Defaults to the tenant's brand colour. */
  tone?: HeroTone;
  preheader?: string;
  /** One line under the headline (plain text, escaped here). */
  subtitle?: string;
  /** Footer hint: 'preferences' for non-security notification mail; default is the generic "ignore if unexpected" line. */
  footerHint?: 'preferences' | 'security' | 'none';
}

/** Escapes text for safe interpolation into HTML text or a double-quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Only http(s)/mailto URLs survive; anything else (javascript:, data:) becomes '#'. Result is attribute-escaped. */
export function safeUrl(url: string): string {
  const trimmed = String(url ?? '').trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? escapeHtml(trimmed) : '#';
}

/** Escapes plain text and preserves line breaks. */
export function textBlock(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br/>');
}

// ── colour maths ───────────────────────────────────────────────────────────
type RGB = [number, number, number];
const DEFAULT_PRIMARY = '#4f46e5';
const clamp = (n: number, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, n));

function oklchToRgb(l: number, c: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin: RGB = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const enc = (v: number) => clamp(Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055)));
  return [enc(lin[0]), enc(lin[1]), enc(lin[2])];
}

/** Parses #rgb / #rrggbb / rgb() / oklch() into sRGB, or null. */
export function parseColor(input: string | undefined): RGB | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]!].map((ch) => parseInt(ch + ch, 16)) as RGB;
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return [parseInt(m[1]!.slice(0, 2), 16), parseInt(m[1]!.slice(2, 4), 16), parseInt(m[1]!.slice(4, 6), 16)];
  m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(s);
  if (m) return [clamp(+m[1]!), clamp(+m[2]!), clamp(+m[3]!)];
  m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(s);
  if (m) {
    const l = m[2] ? +m[1]! / 100 : +m[1]!;
    if ([l, +m[3]!, +m[4]!].every(Number.isFinite)) return oklchToRgb(l, +m[3]!, +m[4]!);
  }
  return null;
}

const toHex = (rgb: RGB) => `#${rgb.map((v) => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** Darkens `rgb` toward black until it reaches `min` contrast against `against`. */
function ensureContrast(rgb: RGB, against: RGB, min: number): RGB {
  let out = rgb;
  for (let i = 0; i < 20 && contrast(out, against) < min; i += 1) out = mix(out, [0, 0, 0], 0.12);
  return out;
}

const WHITE: RGB = [255, 255, 255];
const TONE_HEX: Record<Exclude<HeroTone, 'brand'>, string> = {
  success: '#15803d',
  warning: '#b45309',
  danger: '#dc2626',
  info: '#2563eb',
};
function brandRgb(branding: EmailBranding): RGB {
  return parseColor(branding.primaryColor) ?? parseColor(DEFAULT_PRIMARY)!;
}

/** Brand accent for text/links on white — darkened if needed to hit 4.5:1. */
function toneColor(branding: EmailBranding, tone: HeroTone = 'brand'): string {
  if (tone !== 'brand') return TONE_HEX[tone];
  return toHex(ensureContrast(brandRgb(branding), WHITE, 4.5));
}

/** Resolves the right accent colour for a tone against a tenant's brand colour (readable on white). */
export function toneAccent(branding: EmailBranding, tone: HeroTone = 'brand'): string {
  return toneColor(branding, tone);
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',Consolas,Menlo,monospace";
const RULE = '#e3e5ea';

/**
 * Plain, letter-style shell: white page, left-aligned 600px column, small logo + tenant name, thin accent rule,
 * title, body, sign-off area (via `signature()`), muted footer. No cards, gradients or medallions.
 * `hero.icon`/`tone` are accepted for API compatibility; tone only tints the thin top rule.
 */
export function renderEmailLayout(branding: EmailBranding, hero: HeroOptions, bodyHtml: string): string {
  const accent = toneColor(branding, hero.tone);
  const name = escapeHtml(branding.tenantName);
  const isPlatform = branding.isPlatform || branding.tenantName === 'FitCloud';

  const logo = branding.logoUrl
    ? `<img src="${safeUrl(branding.logoUrl)}" alt="${name}" height="28" style="height:28px;max-width:140px;display:block;border:0;" />`
    : '';
  const preheader = hero.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;">${escapeHtml(hero.preheader.slice(0, 140))}${'&#847;&zwnj;&nbsp;'.repeat(30)}</div>`
    : '';
  const hint =
    hero.footerHint === 'preferences'
      ? `You're receiving this because you have an account or membership with ${name}. Contact ${name} to change which messages you get.`
      : hero.footerHint === 'security'
        ? `This is a security notice related to your account. If this wasn't you, please act on it straight away.`
        : hero.footerHint === 'none'
          ? ''
          : `If you weren't expecting this email, you can safely ignore it.`;
  const support = branding.supportEmail
    ? ` Questions? <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color:#5f6676;">${escapeHtml(branding.supportEmail)}</a>`
    : '';
  const sentBy = isPlatform ? `FitCloud &middot; gym management platform` : `${name} &middot; Sent via FitCloud`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(hero.title)} &ndash; ${name}</title>
<style>
  :root { color-scheme: light dark; }
  @media only screen and (max-width: 620px) {
    .fc-wrap { padding: 20px 18px !important; }
    .fc-btn-link { display: block !important; text-align: center !important; }
    .fc-btn-table, .fc-btn-cell { width: 100% !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .fc-page { background: #14161c !important; }
    .fc-text, .fc-text * { color: #e6e8ef !important; }
    .fc-strong { color: #ffffff !important; }
    .fc-muted, .fc-muted a { color: #a3a9b8 !important; }
    .fc-border { border-color: #343947 !important; }
    .fc-accent { color: #a5b4fc !important; }
  }
</style>
</head>
<body class="fc-page" style="margin:0;padding:0;background:#ffffff;font-family:${FONT};-webkit-text-size-adjust:100%;">
${preheader}
<table role="presentation" class="fc-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="left" class="fc-wrap" style="padding:28px 24px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 0 14px;border-bottom:3px solid ${accent};font-family:${FONT};">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    ${logo ? `<td valign="middle" style="padding-right:10px;">${logo}</td>` : ''}
    <td valign="middle" class="fc-strong" style="font-size:17px;font-weight:700;color:#14151f;">${name}</td>
    <td valign="middle" class="fc-muted" style="padding-left:12px;font-size:12px;color:#667085;">${escapeHtml(hero.categoryLabel)}</td>
  </tr></table>
</td></tr>
<tr><td class="fc-text" style="padding:26px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:#2b2f3b;">
  <h1 class="fc-strong" style="margin:0 0 ${hero.subtitle ? '4' : '18'}px;font-size:21px;line-height:1.3;font-weight:700;color:#14151f;">${escapeHtml(hero.title)}</h1>
  ${hero.subtitle ? `<p class="fc-muted" style="margin:0 0 18px;font-size:14px;color:#667085;">${escapeHtml(hero.subtitle)}</p>` : ''}
  ${bodyHtml}
</td></tr>
<tr><td class="fc-muted fc-border" style="padding:20px 0 0;border-top:1px solid ${RULE};font-family:${FONT};font-size:12px;line-height:1.6;color:#667085;">
  <div>${sentBy}</div>
  ${hint || support ? `<div style="margin-top:4px;">${hint}${support}</div>` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── building blocks (plain letter style) ───────────────────────────────────

/** Body paragraph. `html` must be safe HTML. */
export function paragraph(html: string): string {
  return `<p class="fc-text" style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b2f3b;">${html}</p>`;
}

/** Bold inline emphasis for a plain string (escaped here). */
export function strong(text: string): string {
  return `<strong class="fc-strong" style="color:#14151f;">${escapeHtml(text)}</strong>`;
}

/** Simple solid primary button (Outlook-safe table cell). `label` and `url` are escaped here. */
export function actionButton(url: string, label: string, color?: string): string {
  const rgb = parseColor(color) ?? parseColor(DEFAULT_PRIMARY)!;
  const bg = toHex(ensureContrast(rgb, WHITE, 4.5));
  return `<table role="presentation" cellpadding="0" cellspacing="0" class="fc-btn-table" style="margin:20px 0 8px;">
  <tr><td class="fc-btn-cell" align="center" bgcolor="${bg}" style="border-radius:4px;background:${bg};">
    <a href="${safeUrl(url)}" class="fc-btn-link" target="_blank" style="display:inline-block;padding:11px 24px;color:#ffffff;text-decoration:none;font-family:${FONT};font-weight:600;font-size:15px;border-radius:4px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

/** Muted fallback link ("or paste this link"). */
export function secondaryLink(url: string, label = url): string {
  const u = safeUrl(url);
  return `<p class="fc-muted" style="margin:8px 0 14px;font-size:12.5px;line-height:1.5;color:#667085;word-break:break-all;">${label !== url ? `${escapeHtml(label)}: ` : ''}<a href="${u}" class="fc-accent" style="color:#4f46e5;">${escapeHtml(url)}</a></p>`;
}

/** Muted footnote (plain text, escaped). */
export function footnote(text: string): string {
  return `<p class="fc-muted" style="margin:14px 0 6px;font-size:13px;line-height:1.55;color:#667085;">${escapeHtml(text)}</p>`;
}

/** Muted rule-separated note (plain text, escaped). */
export function muted(text: string): string {
  return `<p class="fc-muted fc-border" style="margin:20px 0 6px;padding-top:14px;border-top:1px solid ${RULE};font-size:12.5px;line-height:1.6;color:#667085;">${escapeHtml(text)}</p>`;
}

/** Quote-style passage with a thin left rule (no fill). `innerHtml` must be safe HTML. */
export function infoBox(innerHtml: string, color = DEFAULT_PRIMARY): string {
  return `<div class="fc-text" style="margin:16px 0;padding:2px 0 2px 14px;border-left:3px solid ${escapeHtml(color)};color:#2b2f3b;">${innerHtml}</div>`;
}

/** Plain note: optional bold lead-in (tone-coloured text) followed by copy. `innerHtml` safe HTML; `title` escaped. */
export function alertBox(tone: Exclude<HeroTone, 'brand'>, title: string | null, innerHtml: string): string {
  return `<p class="fc-text" style="margin:14px 0;font-size:14.5px;line-height:1.6;color:#2b2f3b;">${
    title ? `<strong style="color:${TONE_HEX[tone]};">${escapeHtml(title)}.</strong> ` : ''
  }${innerHtml}</p>`;
}

/** Verification code: large monospace text, no boxes. */
export function codeBlock(code: string, color = DEFAULT_PRIMARY): string {
  const c = toHex(ensureContrast(parseColor(color) ?? parseColor(DEFAULT_PRIMARY)!, WHITE, 4.5));
  return `<p class="fc-accent" style="margin:20px 0;font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:0.28em;color:${c};">${escapeHtml(code)}</p>`;
}

/** One label/value row. `icon` is ignored (plain style); `label` escaped; `value` is safe HTML. */
export function detailRow(_icon: string, label: string, value: string, opts?: { emphasize?: boolean; color?: string }): string {
  const valueStyle = opts?.emphasize ? `font-weight:700;color:${opts.color ?? '#14151f'};` : 'color:#2b2f3b;';
  return `<tr>
  <td class="fc-border fc-muted" valign="top" style="padding:9px 12px 9px 0;border-bottom:1px solid ${RULE};color:#667085;font-size:14px;">${escapeHtml(label)}</td>
  <td class="fc-border fc-text" align="right" valign="top" style="padding:9px 0;border-bottom:1px solid ${RULE};font-size:14px;${valueStyle}">${value}</td>
</tr>`;
}

/** Plain two-column summary table with thin dividers. */
export function detailTable(rowsHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 18px;border-top:1px solid ${RULE};">${rowsHtml}</table>`;
}

/** Small section heading. */
export function sectionTitle(text: string): string {
  return `<p class="fc-strong" style="margin:22px 0 6px;font-size:15px;font-weight:700;color:#14151f;">${escapeHtml(text)}</p>`;
}

/** Status shown as bold coloured text. `label` escaped. */
export function statusBadge(label: string, tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral'): string {
  const color = { success: '#15803d', warning: '#b45309', danger: '#b91c1c', neutral: '#475467' }[tone];
  return `<span style="color:${color};font-weight:700;">${escapeHtml(label)}</span>`;
}

/** Inline tone-coloured label (alias of statusBadge). */
export function heroBadge(label: string, tone: Exclude<HeroTone, 'brand'> = 'info'): string {
  return statusBadge(label, { success: 'success', warning: 'warning', danger: 'danger', info: 'neutral' }[tone] as 'success' | 'warning' | 'danger' | 'neutral');
}

/** Decorative strip — rendered as a plain muted line (text only). */
export function iconStrip(items: Array<{ icon: string; label: string }>): string {
  return `<p class="fc-muted" style="margin:18px 0 4px;font-size:13px;color:#667085;">${items.map((i) => escapeHtml(i.label)).join(' &middot; ')}</p>`;
}

/** Key figures as a plain two-column table (label / value). */
export function keyFacts(items: Array<{ icon?: string; label: string; value: string; color?: string }>): string {
  return detailTable(items.map((it) => detailRow('', it.label, escapeHtml(it.value), { emphasize: true, color: it.color })).join(''));
}

/** Backwards-compatible alias of keyFacts. */
export function statGrid(stats: Array<{ icon: string; label: string; value: string; color?: string }>): string {
  return keyFacts(stats);
}

/** Numbered plain steps. Title/body are plain text, escaped. */
export function stepList(steps: Array<{ title: string; body?: string }>, _color = DEFAULT_PRIMARY): string {
  const items = steps
    .map((s) => `<li style="margin:0 0 6px;"><span class="fc-strong" style="color:#14151f;font-weight:600;">${escapeHtml(s.title)}</span>${s.body ? ` &ndash; <span class="fc-muted" style="color:#667085;">${escapeHtml(s.body)}</span>` : ''}</li>`)
    .join('');
  return `<ol class="fc-text" style="margin:8px 0 14px;padding-left:22px;font-size:14.5px;line-height:1.6;color:#2b2f3b;">${items}</ol>`;
}

/** Plain checklist. Text escaped. */
export function checklist(items: Array<{ label: string; done?: boolean }>): string {
  const rows = items.map((it) => `<li style="margin:0 0 4px;list-style:none;">${it.done ? '&#10003;' : '&#9744;'}&nbsp; ${escapeHtml(it.label)}</li>`).join('');
  return `<ul class="fc-text" style="margin:8px 0 14px;padding-left:0;font-size:14.5px;line-height:1.6;color:#2b2f3b;">${rows}</ul>`;
}

/** Plain dated list. Text escaped. */
export function timeline(items: Array<{ title: string; body?: string; when?: string; state?: 'done' | 'current' | 'upcoming' }>, _color = DEFAULT_PRIMARY): string {
  const rows = items
    .map((it) => `<li style="margin:0 0 6px;"><strong class="fc-strong" style="color:#14151f;">${escapeHtml(it.title)}</strong>${it.when ? ` (${escapeHtml(it.when)})` : ''}${it.body ? ` &ndash; ${escapeHtml(it.body)}` : ''}</li>`)
    .join('');
  return `<ul class="fc-text" style="margin:8px 0 14px;padding-left:20px;font-size:14.5px;line-height:1.6;color:#2b2f3b;">${rows}</ul>`;
}

/** Plain link list. */
export function linkList(items: Array<{ label: string; url: string; description?: string }>): string {
  const rows = items
    .map((it) => `<li style="margin:0 0 4px;"><a href="${safeUrl(it.url)}" class="fc-accent" style="color:#4f46e5;">${escapeHtml(it.label)}</a>${it.description ? ` &ndash; ${escapeHtml(it.description)}` : ''}</li>`)
    .join('');
  return `<ul class="fc-text" style="margin:8px 0 14px;padding-left:20px;font-size:14.5px;line-height:1.6;color:#2b2f3b;">${rows}</ul>`;
}

/** Help line + sign-off: "Need help?" with the gym's real contact details when known, then "Regards, <Tenant> Team". */
export function signature(branding: EmailBranding, line = 'Regards,'): string {
  const isPlatform = branding.isPlatform || branding.tenantName === 'FitCloud';
  const contacts = [
    branding.supportEmail ? `<a href="mailto:${escapeHtml(branding.supportEmail)}" class="fc-accent" style="color:#4f46e5;">${escapeHtml(branding.supportEmail)}</a>` : '',
    branding.supportPhone ? escapeHtml(branding.supportPhone) : '',
  ].filter(Boolean);
  const help = contacts.length
    ? `<p class="fc-text" style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#2b2f3b;"><strong class="fc-strong" style="color:#14151f;">Need help?</strong> Contact ${isPlatform ? 'FitCloud support' : escapeHtml(branding.tenantName)} at ${contacts.join(' or ')}.</p>`
    : '';
  return `${help}<p class="fc-text" style="margin:18px 0 4px;font-size:15px;line-height:1.6;color:#2b2f3b;">${escapeHtml(line)}<br/>${isPlatform ? 'The FitCloud Team' : `${escapeHtml(branding.tenantName)} Team`}</p>`;
}

/** Currency amount with the tenant's own symbol and en-IN digit grouping. */
export function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Default platform (FitCloud-originated) branding. */
export const PLATFORM_BRANDING: EmailBranding = { tenantName: 'FitCloud', isPlatform: true };

/** Safe, human-readable date (en-IN, e.g. "5 Oct 2026"). Returns the input unchanged if unparseable. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Derives a readable plain-text alternative from rendered HTML (used by the mailer for every message). */
export function htmlToText(html: string): string {
  const body = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  return body
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const l = label.replace(/<[^>]+>/g, '').trim();
      const h = href.replace(/&amp;/g, '&');
      return !h || h === '#' || l === h ? l || h : `${l} (${h})`;
    })
    .replace(/<\/(tr)>/gi, '\n')
    .replace(/<\/(td)>/gi, '  ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h1|ol|ul|table)>|<br\s*\/?>/gi, '\n')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&ndash;/g, '-').replace(/&rarr;/g, '->').replace(/&zwnj;|&#847;/g, '')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(+n))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

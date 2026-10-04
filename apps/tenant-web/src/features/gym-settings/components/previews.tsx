'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, CalendarClock, Dumbbell, Globe, IdCard, Mail, MapPin, Palette, Phone, Receipt } from 'lucide-react';

import { useMotionSafe } from '@/features/reports/lib/motion';
import { accentColor, seriesColor } from '@/features/reports/lib/reports-theme';
import type { BusinessHours, BusinessSettings, SocialLinks, ThemePreference, Weekday } from '../types';
import { PreviewCard, StatusChip } from './settings-ui';

/** Any CSS colour the browser understands (hex, oklch, rgb, names); otherwise the fallback. */
function safeColor(v: string | null | undefined, fallback: string): string {
  const s = (v ?? '').trim();
  if (!s) return fallback;
  try {
    return typeof CSS !== 'undefined' && CSS.supports('color', s) ? s : fallback;
  } catch {
    return fallback;
  }
}

// ── Branding ─────────────────────────────────────────────────────────────

const PALETTES = {
  LIGHT: { bg: '#f1f5f9', card: '#ffffff', fg: '#0f172a', muted: '#64748b', border: '#e2e8f0' },
  DARK: { bg: '#0b1020', card: '#151b2e', fg: '#f1f5f9', muted: '#94a3b8', border: '#27304a' },
  // SYSTEM follows the viewer's device, so the preview simply uses the app's own tokens.
  SYSTEM: { bg: 'var(--muted)', card: 'var(--card)', fg: 'var(--foreground)', muted: 'var(--muted-foreground)', border: 'var(--border)' },
} satisfies Record<ThemePreference, Record<string, string>>;

function Logo({ url, name, primary }: { url: string | null; name: string; primary: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- data: URL / API asset preview
    <img src={url} alt="" className="size-7 rounded-md object-contain" />
  ) : (
    <span className="flex size-7 items-center justify-center rounded-md text-xs font-extrabold text-white" style={{ backgroundColor: primary }}>
      {(name.trim()[0] ?? 'G').toUpperCase()}
    </span>
  );
}

/** Mini login screen + sidebar/dashboard driven by the (unsaved) colour/theme/message form and the saved uploads. */
export function BrandingPreview({
  primaryColor,
  secondaryColor,
  theme,
  welcomeMessage,
  logoUrl,
  loginBackgroundUrl,
  dashboardBannerUrl,
  gymName,
}: {
  primaryColor: string;
  secondaryColor: string;
  theme: ThemePreference;
  welcomeMessage: string;
  logoUrl: string | null;
  loginBackgroundUrl: string | null;
  dashboardBannerUrl: string | null;
  gymName: string;
}) {
  const p = PALETTES[theme];
  const primary = safeColor(primaryColor, 'var(--primary)');
  const secondary = safeColor(secondaryColor, 'var(--chart-3)');
  const name = gymName || 'Your gym';
  return (
    <PreviewCard title="Branding preview" icon={Palette} tone="staff" subtitle={`Login and portal, ${theme === 'SYSTEM' ? 'following the viewer’s device theme' : `${theme.toLowerCase()} theme`}`}>
      <div className="space-y-3">
        <div
          className="relative overflow-hidden rounded-xl border"
          style={{ borderColor: p.border, backgroundColor: p.bg, backgroundImage: loginBackgroundUrl ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url("${loginBackgroundUrl}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="mx-auto my-4 w-[78%] rounded-xl p-3.5 shadow-md transition-colors duration-300" style={{ backgroundColor: p.card, color: p.fg }}>
            <div className="flex items-center gap-2">
              <Logo url={logoUrl} name={name} primary={primary} />
              <span className="truncate text-xs font-extrabold">{name}</span>
            </div>
            <p className="mt-2.5 min-h-4 text-[11px] font-semibold" style={{ color: welcomeMessage.trim() ? p.fg : p.muted }}>
              {welcomeMessage.trim() || 'No welcome message set'}
            </p>
            <div className="mt-2 space-y-1.5">
              <div className="h-5 rounded-md border" style={{ borderColor: p.border }} />
              <div className="h-5 rounded-md border" style={{ borderColor: p.border }} />
              <div className="flex h-6 items-center justify-center rounded-md text-[10px] font-bold text-white transition-colors duration-300" style={{ backgroundColor: primary }}>
                Sign in
              </div>
            </div>
          </div>
        </div>
        <div className="flex h-[150px] overflow-hidden rounded-xl border" style={{ borderColor: p.border, backgroundColor: p.bg }}>
          <div className="flex w-[34%] flex-col gap-1.5 border-r p-2" style={{ backgroundColor: p.card, borderColor: p.border }}>
            <div className="mb-1 flex items-center gap-1.5">
              <Logo url={logoUrl} name={name} primary={primary} />
              <span className="truncate text-[10px] font-extrabold" style={{ color: p.fg }}>{name}</span>
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-5 items-center gap-1.5 rounded-md px-1.5 transition-colors duration-300" style={{ backgroundColor: i === 0 ? `color-mix(in oklch, ${primary} 18%, transparent)` : undefined }}>
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: i === 0 ? primary : p.muted, opacity: i === 0 ? 1 : 0.45 }} />
                <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i === 0 ? primary : p.muted, opacity: i === 0 ? 0.7 : 0.3 }} />
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-2 p-2">
            <div
              className="h-[52px] rounded-lg transition-all duration-300"
              style={{ backgroundImage: dashboardBannerUrl ? `url("${dashboardBannerUrl}")` : `linear-gradient(115deg, ${primary}, ${secondary})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div className="grid grid-cols-3 gap-1.5">
              {[primary, secondary, primary].map((c, i) => (
                <div key={i} className="rounded-md p-1.5 transition-colors duration-300" style={{ backgroundColor: p.card, boxShadow: `inset 0 -2px 0 ${c}` }}>
                  <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: p.muted, opacity: 0.4 }} />
                  <div className="mt-1.5 h-2.5 w-1/2 rounded-full" style={{ backgroundColor: c }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Logo and banner shown are the images already uploaded (uploads save immediately). Colours, theme and message reflect the unsaved form.</p>
      </div>
    </PreviewCard>
  );
}

// ── Invoice ──────────────────────────────────────────────────────────────

export function InvoicePreview({ prefix, taxPercentage, termsDays, footer, gymName }: { prefix: string; taxPercentage: number; termsDays: number; footer: string | null; gymName: string }) {
  const today = new Date();
  const due = new Date(today.getTime() + Math.max(0, Number.isFinite(termsDays) ? termsDays : 0) * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <PreviewCard title="Invoice preview" icon={Receipt} tone="finance" subtitle="Sample header - number and dates are illustrative">
      <div className="rounded-xl border bg-background p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{gymName || 'Your gym'}</p>
            <p className="text-[11px] text-muted-foreground">Invoice</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-extrabold" style={{ color: accentColor('finance') }}>
              {(prefix.trim() || '---')}-000123
            </p>
            <p className="text-[11px] text-muted-foreground">Issued {fmt(today)}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Payment terms</p>
            <p className="font-semibold">{termsDays > 0 ? `Net ${termsDays} days` : 'Due on receipt'}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Due date</p>
            <p className="font-semibold">{fmt(due)}</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {[70, 52].map((w) => (
            <div key={w} className="flex items-center justify-between gap-3">
              <span className="h-2 rounded-full bg-muted" style={{ width: `${w}%` }} />
              <span className="h-2 w-10 rounded-full bg-muted" />
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-1.5 text-xs">
            <span className="font-semibold text-muted-foreground">Tax ({Number.isFinite(taxPercentage) ? taxPercentage : 0}%)</span>
            <span className="h-2 w-10 rounded-full bg-muted" />
          </div>
        </div>
        <p className="mt-3 border-t pt-2 text-center text-[11px] italic text-muted-foreground">{footer?.trim() || 'No footer set'}</p>
      </div>
    </PreviewCard>
  );
}

// ── Business settings ────────────────────────────────────────────────────

type BusinessForm = Omit<BusinessSettings, 'updatedAt'>;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(now: Date, tz: string, fmt: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const g = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
    if (fmt === 'DD/MM/YYYY') return `${g('day')}/${g('month')}/${g('year')}`;
    if (fmt === 'YYYY-MM-DD') return `${g('year')}-${g('month')}-${g('day')}`;
    return `${g('month')}/${g('day')}/${g('year')}`;
  } catch {
    return null;
  }
}
function formatTime(now: Date, tz: string, fmt: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', fmt === '24h' ? { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
  } catch {
    return null;
  }
}
function formatCurrency(code: string, locale: string): string | null {
  for (const loc of [locale || 'en', 'en']) {
    try {
      return new Intl.NumberFormat(loc, { style: 'currency', currency: code, currencyDisplay: 'code' }).format(1234.5);
    } catch {
      /* try next locale */
    }
  }
  return null;
}

export function BusinessPreview({ form }: { form: BusinessForm }) {
  const now = new Date();
  const date = formatDate(now, form.timezone, form.dateFormat);
  const time = formatTime(now, form.timezone, form.timeFormat);
  const code = formatCurrency(form.currency, form.locale);
  const imperial = form.measurementUnit === 'IMPERIAL';
  const week = Array.from({ length: 7 }, (_, i) => DAY_NAMES[(form.weekStartDay + i) % 7]!);
  const rows: { label: string; value: string | null }[] = [
    { label: 'Today', value: date },
    { label: `Time in ${form.timezone || 'timezone'}`, value: time },
    { label: 'Amount', value: `${form.currencySymbol}1,234.50` },
    { label: 'Amount (ISO)', value: code },
    { label: 'Body metrics', value: imperial ? '159 lb - 69 in' : '72 kg - 175 cm' },
  ];
  return (
    <PreviewCard title="Format preview" icon={Globe} tone="operations" subtitle="Your selected settings applied to sample values">
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <dt className="text-xs font-semibold text-muted-foreground">{r.label}</dt>
            <dd className="text-right font-bold tabular-nums">{r.value ?? <span className="text-xs font-semibold text-destructive">Invalid value</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Week starts on {DAY_NAMES[form.weekStartDay]}</p>
        <div className="grid grid-cols-7 gap-1">
          {week.map((d, i) => (
            <span key={d} className="rounded-md py-1 text-center text-[11px] font-bold transition-colors" style={i === 0 ? { backgroundColor: accentColor('operations'), color: 'white' } : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              {d}
            </span>
          ))}
        </div>
      </div>
    </PreviewCard>
  );
}

// ── Profile ──────────────────────────────────────────────────────────────

const WEEK: { key: Weekday; short: string; label: string }[] = [
  { key: 'monday', short: 'Mon', label: 'Monday' },
  { key: 'tuesday', short: 'Tue', label: 'Tuesday' },
  { key: 'wednesday', short: 'Wed', label: 'Wednesday' },
  { key: 'thursday', short: 'Thu', label: 'Thursday' },
  { key: 'friday', short: 'Fri', label: 'Friday' },
  { key: 'saturday', short: 'Sat', label: 'Saturday' },
  { key: 'sunday', short: 'Sun', label: 'Sunday' },
];

const toMinutes = (t: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Hours open per weekday. Days with no saved entry use the editor's own default (06:00-22:00) so chart and editor agree. */
export function hoursPerDay(value: BusinessHours): { key: Weekday; short: string; label: string; hours: number; range: string }[] {
  return WEEK.map((d) => {
    const day = value[d.key] ?? { open: '06:00', close: '22:00', closed: false };
    const o = toMinutes(day.open);
    const c = toMinutes(day.close);
    if (day.closed || o === null || c === null) return { ...d, hours: 0, range: 'Closed' };
    const diff = c >= o ? c - o : c + 1440 - o; // overnight closes next day
    return { ...d, hours: Math.round((diff / 60) * 10) / 10, range: `${day.open} - ${day.close}` };
  });
}

export function HoursChart({ value }: { value: BusinessHours }) {
  const m = useMotionSafe();
  const data = hoursPerDay(value);
  const max = Math.max(1, ...data.map((d) => d.hours));
  const total = Math.round(data.reduce((s, d) => s + d.hours, 0) * 10) / 10;
  return (
    <PreviewCard title="Weekly opening hours" icon={BarChart3} tone="attendance" subtitle={`${total} hours open per week`}>
      <div className="flex h-[150px] items-end gap-2">
        {data.map((d, i) => (
          <div key={d.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.range}`}>
            <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{d.hours > 0 ? d.hours : '-'}</span>
            <div className="flex w-full flex-1 items-end">
              <motion.div
                className="w-full origin-bottom rounded-t-md"
                style={{ height: `${Math.max(d.hours > 0 ? 6 : 3, (d.hours / max) * 100)}%`, backgroundColor: d.hours > 0 ? seriesColor(i) : 'var(--muted)' }}
                initial={m.reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: m.reduce ? 0 : i * 0.04 }}
              />
            </div>
            <span className="text-[11px] font-semibold">{d.short}</span>
          </div>
        ))}
      </div>
    </PreviewCard>
  );
}

export function BusinessCardPreview({
  gymName,
  businessType,
  description,
  email,
  phone,
  website,
  addressLine,
  city,
  state,
  country,
  postalCode,
  socialLinks,
}: {
  gymName: string;
  businessType: string;
  description: string;
  email: string;
  phone: string;
  website: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  socialLinks: SocialLinks;
}) {
  const address = [addressLine, [city, state].filter(Boolean).join(', '), [country, postalCode].filter(Boolean).join(' ')].filter((x) => x.trim()).join(' - ');
  const lines = [
    { icon: Mail, text: email },
    { icon: Phone, text: phone },
    { icon: Globe, text: website },
    { icon: MapPin, text: address },
  ].filter((l) => l.text.trim());
  const socials = Object.values(socialLinks).filter((v) => v && v.trim()).length;
  return (
    <PreviewCard title="Business card" icon={IdCard} tone="members" subtitle="How your contact details read together">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed)' }}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{gymName.trim() || 'Gym name'}</p>
            <p className="truncate text-[11px] text-white/80">{businessType.trim() || 'Business type'}</p>
          </div>
        </div>
        <div className="space-y-2 p-4">
          {description.trim() ? <p className="line-clamp-3 text-xs text-muted-foreground">{description.trim()}</p> : null}
          {lines.length ? (
            lines.map((l) => (
              <p key={l.text} className="flex items-start gap-2 text-xs">
                <l.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 break-words">{l.text}</span>
              </p>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No contact details yet.</p>
          )}
          {socials > 0 ? (
            <div className="pt-1">
              <StatusChip tone="members" icon={CalendarClock}>{socials} social link{socials === 1 ? '' : 's'}</StatusChip>
            </div>
          ) : null}
        </div>
      </div>
    </PreviewCard>
  );
}


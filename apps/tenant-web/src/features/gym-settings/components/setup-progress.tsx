'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, CheckCircle2, Circle, Palette, Receipt, ShieldCheck, Sparkles, Clock3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { RadialGauge } from '@/features/reports/charts';
import { StaggerGroup, StaggerItem } from '@/features/reports/components/ui';
import { accentChipStyle, accentTint, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { cn } from '@/lib/utils';
import { useBranding, useGymProfile, useInvoiceSettings, useSecuritySettings } from '../hooks/use-gym-settings';
import { SectionCard } from './settings-ui';

export interface SetupItem {
  key: string;
  label: string;
  detail: string;
  /** 0..1 */
  fraction: number;
  href: string;
  icon: LucideIcon;
  tone: ReportAccent;
}

const PROFILE_FIELDS = [
  'gymName', 'legalBusinessName', 'registrationNumber', 'gstVatNumber', 'businessType', 'description',
  'email', 'phone', 'website', 'addressLine', 'city', 'state', 'country', 'postalCode',
] as const;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * Setup progress derived ONLY from the saved settings returned by the existing queries
 * (profile / branding / security / invoice). A query that failed or isn't loaded contributes no item,
 * so the percentage never includes fabricated values.
 */
export function useSetupProgress(): { items: SetupItem[]; percent: number | null; loading: boolean } {
  const profile = useGymProfile();
  const branding = useBranding();
  const security = useSecuritySettings();
  const invoice = useInvoiceSettings();
  const loading = [profile, branding, security, invoice].some((q) => q.isPending);

  const items: SetupItem[] = [];
  if (profile.data) {
    const p = profile.data;
    const filled = PROFILE_FIELDS.filter((f) => String(p[f] ?? '').trim() !== '').length;
    items.push({ key: 'profile', label: 'Profile details', detail: `${filled}/${PROFILE_FIELDS.length} fields`, fraction: filled / PROFILE_FIELDS.length, href: '/gym-settings/profile', icon: Building2, tone: 'operations' });
    const open = DAYS.filter((d) => p.businessHours?.[d] && !p.businessHours[d]!.closed).length;
    items.push({ key: 'hours', label: 'Business hours', detail: `${open}/7 days open`, fraction: open / 7, href: '/gym-settings/profile', icon: Clock3, tone: 'attendance' });
  }
  if (branding.data) {
    const b = branding.data;
    const n = [b.logoUrl, b.faviconUrl, b.loginBackgroundUrl, b.dashboardBannerUrl, b.emailLogoUrl].filter(Boolean).length;
    items.push({ key: 'branding', label: 'Branding assets', detail: `${n}/5 uploaded`, fraction: n / 5, href: '/gym-settings/branding', icon: Palette, tone: 'staff' });
  }
  if (security.data) {
    const n = security.data.mfaRequiredRoles.length;
    items.push({ key: 'mfa', label: '2FA enforced', detail: `${n}/4 roles`, fraction: n / 4, href: '/gym-settings/security', icon: ShieldCheck, tone: 'members' });
  }
  if (invoice.data) {
    const i = invoice.data;
    const n = (i.invoicePrefix.trim() ? 1 : 0) + (i.taxPercentage > 0 ? 1 : 0);
    items.push({ key: 'invoice', label: 'Invoice defaults', detail: `${i.invoicePrefix.trim() ? 'prefix set' : 'no prefix'}, ${i.taxPercentage > 0 ? `tax ${i.taxPercentage}%` : 'no tax'}`, fraction: n / 2, href: '/gym-settings/invoice', icon: Receipt, tone: 'finance' });
  }
  const percent = items.length ? Math.round((items.reduce((s, x) => s + x.fraction, 0) / items.length) * 100) : null;
  return { items, percent, loading };
}

/** Gauge + checklist chips card (top of the Profile page). */
export function SetupProgressCard() {
  const { items, percent, loading } = useSetupProgress();
  return (
    <SectionCard tone="analytics" icon={Sparkles} title="Setup progress" subtitle="How complete your gym's configuration is, from what you have saved so far.">
      {loading ? (
        <div className="flex flex-wrap items-center gap-6">
          <Skeleton className="size-[132px] rounded-full" />
          <div className="grid flex-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      ) : percent === null ? (
        <p className="text-sm text-muted-foreground">Setup progress is unavailable right now.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <RadialGauge value={percent} size={132} thickness={13} color="var(--chart-3)" label="complete" />
          <StaggerGroup step={0.05} className="grid min-w-[260px] flex-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => {
              const done = it.fraction >= 1;
              return (
                <StaggerItem key={it.key}>
                  <Link
                    href={it.href}
                    className={cn('group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                    style={{ borderColor: accentTint(it.tone, done ? 45 : 20) }}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={accentChipStyle(it.tone)}>
                      <it.icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold">{it.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>
                    </span>
                    {done ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Done" /> : <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-label="Incomplete" />}
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      )}
    </SectionCard>
  );
}

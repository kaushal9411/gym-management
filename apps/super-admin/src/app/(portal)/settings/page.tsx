'use client';

/**
 * /settings — banner + KPI tiles (configured count, categories, last update), AI Assistant link card, then one accent
 * panel per category. Each setting is a key-value JSON editor (same KNOWN_SETTINGS + upsert hook as before). Drafts live
 * here so a sticky bar can show "N unsaved" and "Save all" (sequential upserts of the valid, changed drafts).
 * Dropped: nothing. Note: values are shown exactly as the API returns them (the old page did the same).
 */
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bot, ChevronRight, RotateCcw, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, Panel } from '@/features/dashboard/components/ui';
import { Banner, relTime } from '@/features/payments/components/pay-kit';
import { useNow } from '@/features/dashboard/components/use-now';
import { toSettingsError, useSettings, useUpsertSetting } from '@/features/settings/hooks/use-settings';
import type { SystemSetting } from '@/features/settings/types';
import { KpiGrid, SaveBar, TEXTAREA, fmtDateTime } from '@/features/shell/components/page-kit';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';

/** Well-known settings this portal knows how to manage — "Company Information, SMTP, SMS Gateway, Payment Gateway Keys, Storage Provider, Cloudflare, AWS, Redis, Queue Settings, Maintenance Mode." */
const KNOWN_SETTINGS: Array<{ key: string; category: string; label: string; placeholder: string }> = [
  { key: 'company_info', category: 'company', label: 'Company Information', placeholder: '{ "name": "FitCloud Inc.", "supportEmail": "support@fitcloud.com" }' },
  { key: 'smtp', category: 'integrations', label: 'SMTP', placeholder: '{ "host": "smtp.example.com", "port": 587, "user": "...", "from": "no-reply@fitcloud.com" }' },
  { key: 'sms_gateway', category: 'integrations', label: 'SMS Gateway', placeholder: '{ "provider": "kaleyra", "sid": "...", "from": "+1..." }' },
  { key: 'payment_gateway_keys', category: 'integrations', label: 'Payment Gateway Keys', placeholder: '{ "stripe": { "publishableKey": "..." }, "razorpay": { "keyId": "..." } }' },
  { key: 'storage_provider', category: 'infrastructure', label: 'Storage Provider', placeholder: '{ "provider": "s3", "bucket": "fitcloud-uploads" }' },
  { key: 'cloudflare', category: 'infrastructure', label: 'Cloudflare Settings', placeholder: '{ "zoneId": "...", "apiToken": "***" }' },
  { key: 'aws', category: 'infrastructure', label: 'AWS Settings', placeholder: '{ "region": "us-east-1", "accessKeyId": "***" }' },
  { key: 'redis', category: 'infrastructure', label: 'Redis Settings', placeholder: '{ "maxConnections": 20 }' },
  { key: 'queue', category: 'infrastructure', label: 'Queue Settings', placeholder: '{ "concurrency": 5 }' },
  { key: 'maintenance_mode', category: 'platform', label: 'Maintenance Mode', placeholder: '{ "enabled": false, "message": "We will be back shortly." }' },
];

const CATEGORY: Record<string, { label: string; blurb: string; accent: string }> = {
  company: { label: 'Company', blurb: 'Who the platform is.', accent: 'var(--chart-1)' },
  integrations: { label: 'Integrations', blurb: 'Email, SMS and payment gateway configuration.', accent: 'var(--chart-2)' },
  infrastructure: { label: 'Infrastructure', blurb: 'Storage, CDN, cache and queue tuning.', accent: 'var(--chart-3)' },
  platform: { label: 'Platform', blurb: 'Platform-wide switches.', accent: 'var(--chart-4)' },
};

const serialise = (s?: SystemSetting) => (s ? JSON.stringify(s.value, null, 2) : '');
function parse(text: string): { ok: true; value: unknown } | { ok: false } {
  try { return { ok: true, value: text.trim() ? JSON.parse(text) : {} }; } catch { return { ok: false }; }
}

export default function SettingsPage() {
  const settingsQ = useSettings();
  const upsert = useUpsertSetting();
  const canManage = useHasPermission('settings:manage');
  const now = useNow();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const settings = settingsQ.data;
  const byKey = React.useMemo(() => new Map((settings ?? []).map((s) => [s.key, s])), [settings]);
  const textOf = (key: string) => drafts[key] ?? serialise(byKey.get(key));
  const isDirty = (key: string) => drafts[key] !== undefined && drafts[key] !== serialise(byKey.get(key));
  const dirtyKeys = KNOWN_SETTINGS.filter((m) => isDirty(m.key));
  const invalid = dirtyKeys.filter((m) => !parse(textOf(m.key)).ok);

  const saveKeys = async (metas: typeof KNOWN_SETTINGS) => {
    setSaving(true);
    let done = 0;
    for (const meta of metas) {
      const parsed = parse(textOf(meta.key));
      if (!parsed.ok) continue;
      try {
        await upsert.mutateAsync({ key: meta.key, category: meta.category, value: parsed.value });
        setDrafts((d) => { const n = { ...d }; delete n[meta.key]; return n; });
        done += 1;
      } catch (err) {
        toast.error(`${meta.label}: ${toSettingsError(err).message}`);
      }
    }
    setSaving(false);
    if (done) toast.success(done === 1 ? `${metas.find((m) => parse(textOf(m.key)).ok)?.label ?? 'Setting'} saved` : `${done} settings saved`);
  };

  const configured = KNOWN_SETTINGS.filter((m) => byKey.has(m.key)).length;
  const latest = (settings ?? []).reduce<SystemSetting | null>((a, s) => (!a || s.updatedAt > a.updatedAt ? s : a), null);
  const categories = Object.keys(CATEGORY);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">System configuration — stored as key-value JSON, editable per integration.</p>
      </Banner>

      {settingsQ.isError ? <ErrorNote what="settings" message={settingsQ.error?.message} onRetry={() => void settingsQ.refetch()} /> : null}

      <KpiGrid>
        <KpiCard index={0} label="Configured" value={configured} format={fmtInt} fallbackCaption={`of ${KNOWN_SETTINGS.length} known settings`} color="var(--chart-1)" />
        <KpiCard index={1} label="Not configured" value={KNOWN_SETTINGS.length - configured} format={fmtInt} fallbackCaption="still empty" color="var(--chart-4)" />
        <KpiCard index={2} label="Categories" value={categories.length} format={fmtInt} fallbackCaption="company · integrations · infra · platform" color="var(--chart-3)" />
        <KpiCard index={3} label="Last updated" value={latest ? 1 : 0} format={() => (latest ? relTime(latest.updatedAt, now) || fmtDateTime(latest.updatedAt) : 'Never')} fallbackCaption={latest ? (KNOWN_SETTINGS.find((m) => m.key === latest.key)?.label ?? latest.key) : 'nothing saved yet'} color="var(--chart-2)" />
      </KpiGrid>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/settings/ai" className="group flex items-center gap-3 rounded-[14px] border bg-card p-4 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">AI Assistant</span>
            <span className="block text-xs text-muted-foreground">Bring your own provider key for the platform team&apos;s AI assistant.</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <Link href="/settings/notifications" className="group flex items-center gap-3 rounded-[14px] border bg-card p-4 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Send className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Notification Providers</span>
            <span className="block text-xs text-muted-foreground">Real SMTP and messaging credentials for every tenant&apos;s Email, SMS and WhatsApp sends.</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>

      {settingsQ.isPending || !settings ? (
        <Skeleton className="h-96 rounded-[14px]" />
      ) : (
        categories.map((cat, ci) => {
          const metas = KNOWN_SETTINGS.filter((m) => m.category === cat);
          const c = CATEGORY[cat]!;
          return (
            <Panel key={cat} title={c.label} hint={c.blurb} index={ci} bodyClassName="grid gap-4 lg:grid-cols-2">
              {metas.map((meta) => {
                const existing = byKey.get(meta.key);
                const dirty = isDirty(meta.key);
                const bad = dirty && !parse(textOf(meta.key)).ok;
                return (
                  <div key={meta.key} className={cn('min-w-0 space-y-2 rounded-xl border p-3', dirty && 'border-amber-400/60')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`set-${meta.key}`} className="text-sm font-semibold">{meta.label}</label>
                      <Chip tone={existing ? 'green' : 'slate'}>{existing ? 'Configured' : 'Not configured'}</Chip>
                      {dirty ? <Chip tone="amber">Unsaved</Chip> : null}
                    </div>
                    <textarea
                      id={`set-${meta.key}`}
                      className={cn(TEXTAREA, 'h-28 font-mono text-xs', bad && 'border-destructive')}
                      placeholder={meta.placeholder}
                      value={textOf(meta.key)}
                      disabled={!canManage}
                      aria-invalid={bad}
                      onChange={(e) => setDrafts((d) => ({ ...d, [meta.key]: e.target.value }))}
                    />
                    {bad ? <p className="text-xs text-destructive">Must be valid JSON.</p> : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{existing ? `Updated ${fmtDateTime(existing.updatedAt)}` : 'Not configured yet'}</p>
                      <div className="flex gap-1.5">
                        {dirty ? (
                          <Button size="sm" variant="ghost" aria-label={`Revert ${meta.label}`} onClick={() => setDrafts((d) => { const n = { ...d }; delete n[meta.key]; return n; })}><RotateCcw className="size-3.5" aria-hidden /></Button>
                        ) : null}
                        <Button size="sm" onClick={() => void saveKeys([meta])} disabled={!canManage || saving || !dirty || bad}>Save</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Panel>
          );
        })
      )}

      {dirtyKeys.length > 0 ? (
        <SaveBar dirty message={`${dirtyKeys.length} unsaved ${dirtyKeys.length === 1 ? 'setting' : 'settings'}${invalid.length ? ` · ${invalid.length} invalid JSON` : ''}`}>
          <Button variant="outline" onClick={() => setDrafts({})} disabled={saving}>Discard all</Button>
          <Button onClick={() => void saveKeys(dirtyKeys)} disabled={!canManage || saving || invalid.length > 0}>{saving ? 'Saving…' : 'Save all'}</Button>
        </SaveBar>
      ) : null}
    </div>
  );
}

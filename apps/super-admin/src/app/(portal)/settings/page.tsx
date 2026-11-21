'use client';

/**
 * /settings — banner + KPI tiles (configured count, categories, last update), AI Assistant link card, then one accent
 * panel per category. Each setting is a labelled-field form driven by KNOWN_SETTINGS (features/settings/config/schema.ts);
 * the stored value is still ONE JSON object per key, and keys the form doesn't know about are preserved on save.
 * "Advanced: edit as JSON" per setting is the escape hatch. Razorpay has its own card (own endpoints + secrets handling).
 * Drafts (full objects) live here so a sticky bar can show "N unsaved" and "Save all" (sequential upserts of the valid, changed drafts).
 */
import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, ChevronRight, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { usePlatformName } from '@/features/platform/hooks/use-platform-config';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { Panel } from '@/features/dashboard/components/ui';
import { Banner, relTime } from '@/features/payments/components/pay-kit';
import { useNow } from '@/features/dashboard/components/use-now';
import { CATEGORY, KNOWN_SETTINGS, type SettingMeta, type SettingObject } from '@/features/settings/config/schema';
import { RazorpayCard } from '@/features/settings/components/razorpay-card';
import { SettingCard, isDraftDirty } from '@/features/settings/components/setting-card';
import { useRazorpayGateway } from '@/features/settings/hooks/use-razorpay';
import { toSettingsError, useSettings, useUpsertSetting } from '@/features/settings/hooks/use-settings';
import type { SystemSetting } from '@/features/settings/types';
import { KpiGrid, SaveBar, fmtDateTime } from '@/features/shell/components/page-kit';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';

export default function SettingsPage() {
  const settingsQ = useSettings();
  const upsert = useUpsertSetting();
  const canManage = useHasPermission('settings:manage');
  const now = useNow();
  const queryClient = useQueryClient();
  const platformName = usePlatformName();
  const [appNameDraft, setAppNameDraft] = React.useState<string | null>(null);
  const [savingAppName, setSavingAppName] = React.useState(false);
  const appNameValue = appNameDraft ?? platformName;
  const appNameDirty = appNameDraft !== null && appNameDraft.trim() !== platformName;
  const [drafts, setDrafts] = React.useState<Record<string, SettingObject>>({});
  const [badJson, setBadJson] = React.useState<Record<string, boolean>>({});
  // Bumped per key after a save/revert so the card remounts and drops its local UI state (JSON text, secret 'Replace' mode).
  const [epochs, setEpochs] = React.useState<Record<string, number>>({});
  const [saving, setSaving] = React.useState(false);
  const razorpayQ = useRazorpayGateway();

  const saveAppName = async () => {
    const trimmed = appNameValue.trim();
    if (!trimmed) { toast.error('App name is required'); return; }
    setSavingAppName(true);
    try {
      await upsert.mutateAsync({ key: 'platform_identity', category: 'platform', value: { appName: trimmed } });
      setAppNameDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Platform name saved');
    } catch (err) {
      toast.error(toSettingsError(err).message);
    } finally {
      setSavingAppName(false);
    }
  };

  const settings = settingsQ.data;
  const byKey = React.useMemo(() => new Map((settings ?? []).map((s) => [s.key, s])), [settings]);
  const isDirty = (key: string) => isDraftDirty(drafts[key], byKey.get(key));
  const dirtyKeys = KNOWN_SETTINGS.filter((m) => isDirty(m.key));
  const invalid = dirtyKeys.filter((m) => badJson[m.key]);

  const clearDraft = (key: string) => {
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
    setBadJson((b) => ({ ...b, [key]: false }));
    setEpochs((e) => ({ ...e, [key]: (e[key] ?? 0) + 1 }));
  };

  const saveKeys = async (metas: SettingMeta[]) => {
    setSaving(true);
    const saved: string[] = [];
    for (const meta of metas) {
      const draft = drafts[meta.key];
      if (!draft || badJson[meta.key]) continue;
      try {
        await upsert.mutateAsync({ key: meta.key, category: meta.category, value: draft });
        clearDraft(meta.key);
        saved.push(meta.label);
      } catch (err) {
        toast.error(`${meta.label}: ${toSettingsError(err).message}`);
      }
    }
    setSaving(false);
    if (saved.length) toast.success(saved.length === 1 ? `${saved[0]} saved` : `${saved.length} settings saved`);
  };

  const total = KNOWN_SETTINGS.length + 1; // + the Razorpay card
  const configured = KNOWN_SETTINGS.filter((m) => byKey.has(m.key)).length + (razorpayQ.data?.configured ? 1 : 0);
  const latest = (settings ?? []).reduce<SystemSetting | null>((a, s) => (!a || s.updatedAt > a.updatedAt ? s : a), null);
  const categories = Object.keys(CATEGORY) as SettingMeta['category'][];

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">System configuration — fill in the forms below; nothing to paste.</p>
      </Banner>

      <Panel title="Platform Branding" hint="The product name shown across the super-admin portal, the tenant-web portal and the mobile app." index={0}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="platform-app-name">App name</Label>
            <Input
              id="platform-app-name"
              value={appNameValue}
              maxLength={60}
              disabled={!canManage}
              onChange={(e) => setAppNameDraft(e.target.value)}
              placeholder="FitCloud"
            />
          </div>
          <Button onClick={() => void saveAppName()} disabled={!canManage || savingAppName || !appNameDirty}>{savingAppName ? 'Saving…' : 'Save'}</Button>
        </div>
      </Panel>

      {settingsQ.isError ? <ErrorNote what="settings" message={settingsQ.error?.message} onRetry={() => void settingsQ.refetch()} /> : null}

      <KpiGrid>
        <KpiCard index={0} label="Configured" value={configured} format={fmtInt} fallbackCaption={`of ${total} known settings`} color="var(--chart-1)" />
        <KpiCard index={1} label="Not configured" value={total - configured} format={fmtInt} fallbackCaption="still empty" color="var(--chart-4)" />
        <KpiCard index={2} label="Categories" value={categories.length + 1} format={fmtInt} fallbackCaption="company · payments · platform" color="var(--chart-3)" />
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

      <Panel title="Payments" hint="Razorpay keys used for gym subscription checkout and member online payments." index={1} bodyClassName="grid gap-4 lg:grid-cols-2">
        <RazorpayCard canManage={canManage} />
      </Panel>

      {settingsQ.isPending || !settings ? (
        <Skeleton className="h-96 rounded-[14px]" />
      ) : (
        categories.map((cat, ci) => {
          const metas = KNOWN_SETTINGS.filter((m) => m.category === cat);
          const c = CATEGORY[cat]!;
          return (
            <Panel key={cat} title={c.label} hint={c.blurb} index={ci} bodyClassName="grid gap-4 lg:grid-cols-2">
              {metas.map((meta) => (
                <SettingCard
                  key={`${meta.key}-${epochs[meta.key] ?? 0}`}
                  meta={meta}
                  stored={byKey.get(meta.key)}
                  draft={drafts[meta.key]}
                  dirty={isDirty(meta.key)}
                  canManage={canManage}
                  saving={saving}
                  onChange={(next) => setDrafts((d) => ({ ...d, [meta.key]: next }))}
                  onJsonInvalid={(bad) => setBadJson((b) => (b[meta.key] === bad ? b : { ...b, [meta.key]: bad }))}
                  onRevert={() => clearDraft(meta.key)}
                  onSave={() => void saveKeys([meta])}
                />
              ))}
            </Panel>
          );
        })
      )}

      {dirtyKeys.length > 0 ? (
        <SaveBar dirty message={`${dirtyKeys.length} unsaved ${dirtyKeys.length === 1 ? 'setting' : 'settings'}${invalid.length ? ` · ${invalid.length} with invalid JSON` : ''}`}>
          <Button variant="outline" onClick={() => { Object.keys(drafts).forEach(clearDraft); }} disabled={saving}>Discard all</Button>
          <Button onClick={() => void saveKeys(dirtyKeys)} disabled={!canManage || saving || invalid.length > 0}>{saving ? 'Saving…' : 'Save all'}</Button>
        </SaveBar>
      ) : null}
    </div>
  );
}

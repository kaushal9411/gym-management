'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toAdminServiceError } from '@/features/auth/services/api-client';
import { usePlatformNotificationCredentials, useUpdatePlatformNotificationCredentials } from '@/features/notification-settings/hooks/use-notification-settings';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { Chip, Panel } from '@/features/dashboard/components/ui';
import { BackLink, Banner } from '@/features/payments/components/pay-kit';
import { FIELD, Field, KpiGrid, SaveBar } from '@/features/shell/components/page-kit';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';

const API_DOMAINS = [
  { value: '', label: 'Select a region…' },
  { value: 'api.in.kaleyra.io', label: 'India (api.in.kaleyra.io)' },
  { value: 'api.ap.kaleyra.io', label: 'Asia-Pacific (api.ap.kaleyra.io)' },
  { value: 'api.eu.kaleyra.io', label: 'Europe (api.eu.kaleyra.io)' },
  { value: 'api.na.kaleyra.io', label: 'North America (api.na.kaleyra.io)' },
];

interface NotificationSettingsForm {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFromName: string;
  smtpFromAddress: string;
  kaleyraSid: string;
  kaleyraApiDomain: string;
  kaleyraSmsSenderId: string;
  kaleyraWhatsappNumber: string;
}

export default function NotificationProvidersSettingsPage() {
  const canManage = useHasPermission('notification-settings:manage');

  const settings = usePlatformNotificationCredentials();
  const updateSettings = useUpdatePlatformNotificationCredentials();

  const [form, setForm] = React.useState<NotificationSettingsForm | null>(null);
  const [smtpPasswordInput, setSmtpPasswordInput] = React.useState('');
  const [clearSmtpPassword, setClearSmtpPassword] = React.useState(false);
  const [apiKeyInput, setApiKeyInput] = React.useState('');
  const [clearApiKey, setClearApiKey] = React.useState(false);

  React.useEffect(() => {
    if (settings.data && !form) {
      setForm({
        smtpHost: settings.data.smtpHost ?? '',
        smtpPort: settings.data.smtpPort != null ? String(settings.data.smtpPort) : '',
        smtpUser: settings.data.smtpUser ?? '',
        smtpFromName: settings.data.smtpFromName ?? '',
        smtpFromAddress: settings.data.smtpFromAddress ?? '',
        kaleyraSid: settings.data.kaleyraSid ?? '',
        kaleyraApiDomain: settings.data.kaleyraApiDomain ?? '',
        kaleyraSmsSenderId: settings.data.kaleyraSmsSenderId ?? '',
        kaleyraWhatsappNumber: settings.data.kaleyraWhatsappNumber ?? '',
      });
    }
  }, [settings.data, form]);

  const handleSave = async () => {
    if (!form) return;
    try {
      await updateSettings.mutateAsync({
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort === '' ? undefined : Number(form.smtpPort),
        smtpUser: form.smtpUser,
        smtpFromName: form.smtpFromName,
        smtpFromAddress: form.smtpFromAddress,
        kaleyraSid: form.kaleyraSid,
        kaleyraApiDomain: form.kaleyraApiDomain,
        kaleyraSmsSenderId: form.kaleyraSmsSenderId,
        kaleyraWhatsappNumber: form.kaleyraWhatsappNumber,
        ...(smtpPasswordInput.trim() ? { smtpPassword: smtpPasswordInput.trim() } : clearSmtpPassword ? { smtpPassword: '' } : {}),
        ...(apiKeyInput.trim() ? { kaleyraApiKey: apiKeyInput.trim() } : clearApiKey ? { kaleyraApiKey: '' } : {}),
      });
      setSmtpPasswordInput('');
      setClearSmtpPassword(false);
      setApiKeyInput('');
      setClearApiKey(false);
      toast.success('Notification provider settings saved.');
    } catch (error) {
      toast.error(toAdminServiceError(error).message);
    }
  };

  const d = settings.data;
  const dirty = !!form && !!d && (
    form.smtpHost !== (d.smtpHost ?? '') || form.smtpPort !== (d.smtpPort != null ? String(d.smtpPort) : '') ||
    form.smtpUser !== (d.smtpUser ?? '') || form.smtpFromName !== (d.smtpFromName ?? '') || form.smtpFromAddress !== (d.smtpFromAddress ?? '') ||
    form.kaleyraSid !== (d.kaleyraSid ?? '') || form.kaleyraApiDomain !== (d.kaleyraApiDomain ?? '') ||
    form.kaleyraSmsSenderId !== (d.kaleyraSmsSenderId ?? '') || form.kaleyraWhatsappNumber !== (d.kaleyraWhatsappNumber ?? '') ||
    smtpPasswordInput.trim() !== '' || clearSmtpPassword || apiKeyInput.trim() !== '' || clearApiKey
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <BackLink href="/settings">Back to Settings</BackLink>
      <Banner>
        <h1 className="text-2xl font-bold tracking-tight">Notification Providers</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">Real SMTP and messaging credentials used to send every tenant&apos;s Email, SMS and WhatsApp notifications. Each tenant is still gated by its own enable/quota on the Tenant 360 view.</p>
      </Banner>

      {settings.isError ? <ErrorNote what="notification provider settings" message={settings.error?.message} onRetry={() => void settings.refetch()} /> : null}

      <KpiGrid>
        <KpiCard index={0} label="SMTP" value={1} format={() => (d?.smtpHost ? 'Configured' : 'Using .env default')} fallbackCaption={d?.smtpHost ?? 'no host saved here'} color="var(--chart-1)" />
        <KpiCard index={1} label="SMTP password" value={1} format={() => (d?.hasSmtpPassword ? 'Stored' : 'Env var')} fallbackCaption={d?.hasSmtpPassword ? `masked ${d.smtpPasswordMasked ?? ''}` : 'no password saved here'} color="var(--chart-2)" />
        <KpiCard index={2} label="Messaging" value={1} format={() => (d?.kaleyraConfigured ? 'Configured' : 'Not configured')} fallbackCaption={d?.kaleyraSid ?? 'no SID saved here'} color="var(--chart-6)" />
        <KpiCard index={3} label="Messaging API key" value={1} format={() => (d?.hasKaleyraApiKey ? 'Stored' : 'Env var')} fallbackCaption={d?.hasKaleyraApiKey ? `masked ${d.kaleyraApiKeyMasked ?? ''}` : 'no key saved here'} color="var(--chart-4)" />
      </KpiGrid>

      {settings.isPending || !form ? (
        <Skeleton className="h-96 w-full rounded-[14px]" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel title="SMTP (Email)" hint="falls back to the server's .env when blank" index={0}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Host" htmlFor="smtpHost">
                  <input id="smtpHost" className={FIELD} placeholder="smtp.example.com" value={form.smtpHost} disabled={!canManage} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
                </Field>
                <Field label="Port" htmlFor="smtpPort">
                  <input id="smtpPort" type="number" min={1} max={65535} className={FIELD} placeholder="587" value={form.smtpPort} disabled={!canManage} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} />
                </Field>
              </div>
              <Field label="Username" htmlFor="smtpUser">
                <input id="smtpUser" className={FIELD} placeholder="no-reply@fitcloud.com" value={form.smtpUser} disabled={!canManage} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-[13px]">
                <span className="font-semibold">Password status</span>
                <Chip tone={clearSmtpPassword ? 'amber' : d?.hasSmtpPassword ? 'green' : 'slate'}>{clearSmtpPassword ? 'Will be cleared on save' : d?.hasSmtpPassword ? `Saved (${d.smtpPasswordMasked})` : 'Using environment variable'}</Chip>
              </div>
              <Field label="Password" htmlFor="smtpPassword" hint="Write-only — a saved password is never shown back.">
                <input
                  id="smtpPassword"
                  type="password"
                  autoComplete="off"
                  className={FIELD}
                  placeholder={clearSmtpPassword ? 'Will be cleared on save' : d?.hasSmtpPassword ? 'Enter a new password to replace the saved one' : 'Not set — using the environment variable password'}
                  value={smtpPasswordInput}
                  disabled={!canManage || clearSmtpPassword}
                  onChange={(e) => setSmtpPasswordInput(e.target.value)}
                />
              </Field>
              {d?.hasSmtpPassword && canManage ? (
                <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { setClearSmtpPassword((v) => !v); setSmtpPasswordInput(''); }}>
                  {clearSmtpPassword ? 'Cancel clearing password' : 'Clear stored password'}
                </button>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From name" htmlFor="smtpFromName">
                  <input id="smtpFromName" className={FIELD} placeholder="FitCloud" value={form.smtpFromName} disabled={!canManage} onChange={(e) => setForm({ ...form, smtpFromName: e.target.value })} />
                </Field>
                <Field label="From address" htmlFor="smtpFromAddress">
                  <input id="smtpFromAddress" type="email" className={FIELD} placeholder="no-reply@fitcloud.com" value={form.smtpFromAddress} disabled={!canManage} onChange={(e) => setForm({ ...form, smtpFromAddress: e.target.value })} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Messaging (SMS & WhatsApp)" hint="WhatsApp reuses this same account" index={1}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account SID" htmlFor="kaleyraSid">
                  <input id="kaleyraSid" className={FIELD} placeholder="Ac4XXXXXXXXXXXXXXXXXXXXXXXXXX21f" value={form.kaleyraSid} disabled={!canManage} onChange={(e) => setForm({ ...form, kaleyraSid: e.target.value })} />
                </Field>
                <Field label="API region" htmlFor="kaleyraApiDomain">
                  <select id="kaleyraApiDomain" className={FIELD} value={form.kaleyraApiDomain} disabled={!canManage} onChange={(e) => setForm({ ...form, kaleyraApiDomain: e.target.value })}>
                    {API_DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-[13px]">
                <span className="font-semibold">API key status</span>
                <Chip tone={clearApiKey ? 'amber' : d?.hasKaleyraApiKey ? 'green' : 'slate'}>{clearApiKey ? 'Will be cleared on save' : d?.hasKaleyraApiKey ? `Saved (${d.kaleyraApiKeyMasked})` : 'Using environment variable'}</Chip>
              </div>
              <Field label="API key" htmlFor="kaleyraApiKey" hint="Write-only — a saved key is never shown back.">
                <input
                  id="kaleyraApiKey"
                  type="password"
                  autoComplete="off"
                  className={FIELD}
                  placeholder={clearApiKey ? 'Will be cleared on save' : d?.hasKaleyraApiKey ? 'Enter a new key to replace the saved one' : 'Not set — using the environment variable key'}
                  value={apiKeyInput}
                  disabled={!canManage || clearApiKey}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </Field>
              {d?.hasKaleyraApiKey && canManage ? (
                <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { setClearApiKey((v) => !v); setApiKeyInput(''); }}>
                  {clearApiKey ? 'Cancel clearing key' : 'Clear stored key'}
                </button>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SMS sender id" htmlFor="kaleyraSmsSenderId">
                  <input id="kaleyraSmsSenderId" className={FIELD} placeholder="FITCLD" value={form.kaleyraSmsSenderId} disabled={!canManage} onChange={(e) => setForm({ ...form, kaleyraSmsSenderId: e.target.value })} />
                </Field>
                <Field label="WhatsApp number" htmlFor="kaleyraWhatsappNumber">
                  <input id="kaleyraWhatsappNumber" className={FIELD} placeholder="+15551234567" value={form.kaleyraWhatsappNumber} disabled={!canManage} onChange={(e) => setForm({ ...form, kaleyraWhatsappNumber: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">WhatsApp only accepts a free-form message when the recipient has messaged your WhatsApp number within the last 24 hours — otherwise an approved message template is required.</p>
            </div>
          </Panel>
        </div>
      )}

      {canManage && form ? (
        <SaveBar dirty={dirty} message={dirty ? 'Unsaved changes' : 'All changes saved'}>
          <Button onClick={() => void handleSave()} disabled={updateSettings.isPending || !dirty}>{updateSettings.isPending ? 'Saving…' : 'Save'}</Button>
        </SaveBar>
      ) : null}
    </div>
  );
}

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

interface NotificationSettingsForm {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFromName: string;
  smtpFromAddress: string;
  twilioAccountSid: string;
  twilioSmsFromNumber: string;
  twilioWhatsappFromNumber: string;
}

export default function NotificationProvidersSettingsPage() {
  const canManage = useHasPermission('notification-settings:manage');

  const settings = usePlatformNotificationCredentials();
  const updateSettings = useUpdatePlatformNotificationCredentials();

  const [form, setForm] = React.useState<NotificationSettingsForm | null>(null);
  const [smtpPasswordInput, setSmtpPasswordInput] = React.useState('');
  const [clearSmtpPassword, setClearSmtpPassword] = React.useState(false);
  const [twilioAuthTokenInput, setTwilioAuthTokenInput] = React.useState('');
  const [clearTwilioAuthToken, setClearTwilioAuthToken] = React.useState(false);

  React.useEffect(() => {
    if (settings.data && !form) {
      setForm({
        smtpHost: settings.data.smtpHost ?? '',
        smtpPort: settings.data.smtpPort != null ? String(settings.data.smtpPort) : '',
        smtpUser: settings.data.smtpUser ?? '',
        smtpFromName: settings.data.smtpFromName ?? '',
        smtpFromAddress: settings.data.smtpFromAddress ?? '',
        twilioAccountSid: settings.data.twilioAccountSid ?? '',
        twilioSmsFromNumber: settings.data.twilioSmsFromNumber ?? '',
        twilioWhatsappFromNumber: settings.data.twilioWhatsappFromNumber ?? '',
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
        twilioAccountSid: form.twilioAccountSid,
        twilioSmsFromNumber: form.twilioSmsFromNumber,
        twilioWhatsappFromNumber: form.twilioWhatsappFromNumber,
        ...(smtpPasswordInput.trim() ? { smtpPassword: smtpPasswordInput.trim() } : clearSmtpPassword ? { smtpPassword: '' } : {}),
        ...(twilioAuthTokenInput.trim() ? { twilioAuthToken: twilioAuthTokenInput.trim() } : clearTwilioAuthToken ? { twilioAuthToken: '' } : {}),
      });
      setSmtpPasswordInput('');
      setClearSmtpPassword(false);
      setTwilioAuthTokenInput('');
      setClearTwilioAuthToken(false);
      toast.success('Notification provider settings saved.');
    } catch (error) {
      toast.error(toAdminServiceError(error).message);
    }
  };

  const d = settings.data;
  const dirty = !!form && !!d && (
    form.smtpHost !== (d.smtpHost ?? '') || form.smtpPort !== (d.smtpPort != null ? String(d.smtpPort) : '') ||
    form.smtpUser !== (d.smtpUser ?? '') || form.smtpFromName !== (d.smtpFromName ?? '') || form.smtpFromAddress !== (d.smtpFromAddress ?? '') ||
    form.twilioAccountSid !== (d.twilioAccountSid ?? '') || form.twilioSmsFromNumber !== (d.twilioSmsFromNumber ?? '') || form.twilioWhatsappFromNumber !== (d.twilioWhatsappFromNumber ?? '') ||
    smtpPasswordInput.trim() !== '' || clearSmtpPassword || twilioAuthTokenInput.trim() !== '' || clearTwilioAuthToken
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <BackLink href="/settings">Back to Settings</BackLink>
      <Banner>
        <h1 className="text-2xl font-bold tracking-tight">Notification Providers</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">Real SMTP and Twilio credentials used to send every tenant&apos;s Email, SMS and WhatsApp notifications. Each tenant is still gated by its own enable/quota on the Tenant 360 view.</p>
      </Banner>

      {settings.isError ? <ErrorNote what="notification provider settings" message={settings.error?.message} onRetry={() => void settings.refetch()} /> : null}

      <KpiGrid>
        <KpiCard index={0} label="SMTP" value={1} format={() => (d?.smtpHost ? 'Configured' : 'Using .env default')} fallbackCaption={d?.smtpHost ?? 'no host saved here'} color="var(--chart-1)" />
        <KpiCard index={1} label="SMTP password" value={1} format={() => (d?.hasSmtpPassword ? 'Stored' : 'Env var')} fallbackCaption={d?.hasSmtpPassword ? `masked ${d.smtpPasswordMasked ?? ''}` : 'no password saved here'} color="var(--chart-2)" />
        <KpiCard index={2} label="Twilio" value={1} format={() => (d?.twilioConfigured ? 'Configured' : 'Not configured')} fallbackCaption={d?.twilioAccountSid ?? 'no account SID saved here'} color="var(--chart-6)" />
        <KpiCard index={3} label="Twilio auth token" value={1} format={() => (d?.hasTwilioAuthToken ? 'Stored' : 'Env var')} fallbackCaption={d?.hasTwilioAuthToken ? `masked ${d.twilioAuthTokenMasked ?? ''}` : 'no token saved here'} color="var(--chart-4)" />
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

          <Panel title="Twilio (SMS & WhatsApp)" hint="WhatsApp reuses this same Twilio account" index={1}>
            <div className="space-y-4">
              <Field label="Account SID" htmlFor="twilioAccountSid">
                <input id="twilioAccountSid" className={FIELD} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={form.twilioAccountSid} disabled={!canManage} onChange={(e) => setForm({ ...form, twilioAccountSid: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-[13px]">
                <span className="font-semibold">Auth token status</span>
                <Chip tone={clearTwilioAuthToken ? 'amber' : d?.hasTwilioAuthToken ? 'green' : 'slate'}>{clearTwilioAuthToken ? 'Will be cleared on save' : d?.hasTwilioAuthToken ? `Saved (${d.twilioAuthTokenMasked})` : 'Using environment variable'}</Chip>
              </div>
              <Field label="Auth token" htmlFor="twilioAuthToken" hint="Write-only — a saved token is never shown back.">
                <input
                  id="twilioAuthToken"
                  type="password"
                  autoComplete="off"
                  className={FIELD}
                  placeholder={clearTwilioAuthToken ? 'Will be cleared on save' : d?.hasTwilioAuthToken ? 'Enter a new token to replace the saved one' : 'Not set — using the environment variable token'}
                  value={twilioAuthTokenInput}
                  disabled={!canManage || clearTwilioAuthToken}
                  onChange={(e) => setTwilioAuthTokenInput(e.target.value)}
                />
              </Field>
              {d?.hasTwilioAuthToken && canManage ? (
                <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { setClearTwilioAuthToken((v) => !v); setTwilioAuthTokenInput(''); }}>
                  {clearTwilioAuthToken ? 'Cancel clearing token' : 'Clear stored token'}
                </button>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SMS from number" htmlFor="twilioSmsFromNumber">
                  <input id="twilioSmsFromNumber" className={FIELD} placeholder="+15551234567" value={form.twilioSmsFromNumber} disabled={!canManage} onChange={(e) => setForm({ ...form, twilioSmsFromNumber: e.target.value })} />
                </Field>
                <Field label="WhatsApp from number" htmlFor="twilioWhatsappFromNumber">
                  <input id="twilioWhatsappFromNumber" className={FIELD} placeholder="+15551234567" value={form.twilioWhatsappFromNumber} disabled={!canManage} onChange={(e) => setForm({ ...form, twilioWhatsappFromNumber: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">A Twilio trial account can only message numbers verified in the Twilio console, and outgoing messages carry a &quot;sent from a trial account&quot; prefix until upgraded.</p>
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

'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Chip, Panel } from '@/features/dashboard/components/ui';
import { CopyButton, ConfirmRow } from '@/features/payments/components/pay-kit';
import { FIELD, Field, fmtDateTime } from '@/features/shell/components/page-kit';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { toAdminServiceError } from '@/features/auth/services/api-client';
import { cn } from '@/lib/utils';
import { useRazorpayGateway, useRemoveRazorpay, useSaveRazorpay, useTestRazorpay } from '../hooks/use-razorpay';
import type { RazorpayMode, RazorpaySource, TestRazorpayResult } from '../types/razorpay';
import { SecretField, ToggleSwitch } from './controls';

const KEY_ID_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{6,}$/;
const KEY_ID_ERROR = 'Key ID should look like rzp_test_xxxxxxxx or rzp_live_xxxxxxxx (from Razorpay Dashboard → Settings → API Keys).';

const SOURCE_TEXT: Record<RazorpaySource, string> = {
  database: 'Using keys saved here.',
  environment: "Using the server's environment variables.",
  none: 'Not configured — online payments are unavailable until keys are added.',
};

/** Mode from the Key ID prefix, so the badge reacts while typing. */
const modeOf = (keyId: string): RazorpayMode | null => (keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : null);

/** Dedicated card for the platform's Razorpay keys (replaces the old `payment_gateway_keys` JSON entry). */
export function RazorpayCard({ canManage }: { canManage: boolean }) {
  const q = useRazorpayGateway();
  const save = useSaveRazorpay();
  const test = useTestRazorpay();
  const remove = useRemoveRazorpay();

  // Drafts: null = "untouched, show what is stored". Secrets hold only what the user typed.
  const [keyIdDraft, setKeyIdDraft] = React.useState<string | null>(null);
  const [secretDraft, setSecretDraft] = React.useState('');
  const [webhookDraft, setWebhookDraft] = React.useState('');
  const [enabledDraft, setEnabledDraft] = React.useState<boolean | null>(null);
  const [result, setResult] = React.useState<TestRazorpayResult | { ok: false; mode: null; message: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  // Remount the secret inputs after a save / remove so their "Replace" state resets.
  const [epoch, setEpoch] = React.useState(0);

  const d = q.data;
  if (q.isPending) return <Skeleton className="h-72 rounded-[14px] lg:col-span-2" />;
  if (q.isError || !d) {
    return (
      <div className="lg:col-span-2">
        <ErrorNote what="Razorpay settings" message={q.error?.message} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const storedKeyId = d.keyId ?? '';
  const keyId = (keyIdDraft ?? storedKeyId).trim();
  const enabled = enabledDraft ?? d.isEnabled;
  const mode = modeOf(keyId);
  const keyIdValid = KEY_ID_PATTERN.test(keyId);
  const keyIdError = keyId !== '' && !keyIdValid ? KEY_ID_ERROR : null;
  const secretTyped = secretDraft.trim();
  const webhookTyped = webhookDraft.trim();
  const needsSecret = !d.keySecretSet && secretTyped === '';
  const dirty = (keyIdDraft !== null && keyId !== storedKeyId) || secretTyped !== '' || webhookTyped !== '' || (enabledDraft !== null && enabledDraft !== d.isEnabled);
  const busy = save.isPending || test.isPending || remove.isPending;
  const canSave = canManage && !busy && dirty && keyIdValid && !needsSecret;

  const resetDrafts = () => {
    setKeyIdDraft(null); setSecretDraft(''); setWebhookDraft(''); setEnabledDraft(null); setEpoch((e) => e + 1);
  };

  const onSave = async () => {
    try {
      await save.mutateAsync({
        keyId,
        ...(secretTyped ? { keySecret: secretTyped } : {}),
        ...(webhookTyped ? { webhookSecret: webhookTyped } : {}),
        ...(enabledDraft !== null ? { isEnabled: enabledDraft } : {}),
      });
      resetDrafts();
      setResult(null);
      toast.success('Razorpay keys saved');
    } catch (err) {
      toast.error(toAdminServiceError(err).message);
    }
  };

  const onTest = async () => {
    setResult(null);
    try {
      // Typed values win; anything omitted falls back to what is stored (server-side).
      setResult(await test.mutateAsync({ ...(keyId ? { keyId } : {}), ...(secretTyped ? { keySecret: secretTyped } : {}) }));
    } catch (err) {
      setResult({ ok: false, mode: null, message: toAdminServiceError(err).message });
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync();
      resetDrafts();
      setResult(null);
      setConfirmRemove(false);
      toast.success('Saved Razorpay keys removed');
    } catch (err) {
      toast.error(toAdminServiceError(err).message);
    }
  };

  return (
    <Panel
      title="Razorpay payments"
      hint="Online payments for tenant subscriptions and member fees."
      className="lg:col-span-2"
      right={mode ? <Chip tone={mode === 'live' ? 'red' : 'amber'}>{mode === 'live' ? 'Live mode' : 'Test mode'}</Chip> : null}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[13px]">
          <Chip tone={d.source === 'database' ? 'green' : d.source === 'environment' ? 'blue' : 'slate'}>
            {d.source === 'database' ? 'Saved here' : d.source === 'environment' ? 'Environment' : 'Not configured'}
          </Chip>
          <span className="min-w-0 flex-1">{SOURCE_TEXT[d.source]}</span>
          {d.updatedAt && d.source === 'database' ? <span className="text-xs text-muted-foreground">Updated {fmtDateTime(d.updatedAt)}</span> : null}
        </div>

        {mode === 'live' ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            Live keys move real money. Double-check the Key ID before saving.
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Key ID" htmlFor="rzp-key-id" hint={keyIdError ? undefined : 'Starts with rzp_test_ or rzp_live_.'}>
            <input
              id="rzp-key-id" className={cn(FIELD, keyIdError && 'border-destructive')} placeholder="rzp_test_xxxxxxxxxx" autoComplete="off" spellCheck={false}
              value={keyIdDraft ?? storedKeyId} disabled={!canManage} aria-invalid={!!keyIdError}
              onChange={(e) => setKeyIdDraft(e.target.value)}
            />
            {keyIdError ? <p className="text-xs text-destructive">{keyIdError}</p> : null}
          </Field>
          <Field label="Key secret" htmlFor="rzp-key-secret" hint="Write-only — never shown again after saving.">
            <SecretField
              key={`secret-${epoch}`} id="rzp-key-secret" hasStored={d.keySecretSet}
              savedLabel={d.keySecretLast4 ? `•••••• ending ${d.keySecretLast4}` : '•••••• saved'}
              value={secretDraft} onChange={setSecretDraft} disabled={!canManage}
            />
          </Field>
          <Field label="Webhook secret (optional)" htmlFor="rzp-webhook-secret" hint="Used to verify that webhook calls really come from Razorpay.">
            <SecretField
              key={`webhook-${epoch}`} id="rzp-webhook-secret" hasStored={d.webhookSecretSet} savedLabel="•••••• saved"
              value={webhookDraft} onChange={setWebhookDraft} disabled={!canManage}
            />
          </Field>
          <Field label="Webhook URL" htmlFor="rzp-webhook-url" hint="Paste this into Razorpay Dashboard → Settings → Webhooks.">
            <div className="flex items-center gap-1.5">
              <input id="rzp-webhook-url" readOnly className={cn(FIELD, 'min-w-0 flex-1 bg-muted/40 font-mono text-xs')} value={d.webhookUrl} onFocus={(e) => e.currentTarget.select()} />
              <CopyButton value={d.webhookUrl} label="webhook URL" />
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <label htmlFor="rzp-enabled" className="min-w-0 text-[13px] font-medium">
            Accept online payments
            <span className="block text-xs font-normal text-muted-foreground">Turn off to pause Razorpay without removing the keys.</span>
          </label>
          <ToggleSwitch id="rzp-enabled" label="Accept online payments" checked={enabled} disabled={!canManage} onChange={setEnabledDraft} />
        </div>

        {result ? (
          <p
            role="status"
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]',
              result.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
            )}
          >
            {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span className="min-w-0 break-words">{result.message}{result.ok && result.mode ? ` (${result.mode} mode)` : ''}</span>
          </p>
        ) : null}

        {confirmRemove ? (
          <ConfirmRow
            text="Remove the saved Razorpay keys? Payments will fall back to the server's environment variables (or stop working if none are set)."
            confirmLabel="Remove keys" busy={remove.isPending} onCancel={() => setConfirmRemove(false)} onConfirm={() => void onRemove()}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void onTest()} disabled={!canManage || busy || (keyId !== '' ? !keyIdValid : !d.configured)}>{test.isPending ? 'Testing…' : 'Test connection'}</Button>
          <Button onClick={() => void onSave()} disabled={!canSave}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          {dirty ? <Button variant="ghost" onClick={resetDrafts} disabled={busy}>Discard</Button> : null}
          {d.source === 'database' && canManage ? (
            <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => setConfirmRemove(true)} disabled={busy || confirmRemove}>Remove saved keys</Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

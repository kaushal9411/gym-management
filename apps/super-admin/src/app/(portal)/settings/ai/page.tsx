'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toAdminServiceError } from '@/features/auth/services/api-client';
import { usePlatformAiSettings, useResetPlatformAiSettings, useUpdatePlatformAiSettings } from '@/features/ai-assistant/hooks/use-ai-assistant';
import type { AiProviderName } from '@/features/ai-assistant/types';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { Chip, Panel } from '@/features/dashboard/components/ui';
import { BackLink, Banner, ConfirmRow } from '@/features/payments/components/pay-kit';
import { FIELD, Field, KpiGrid, SaveBar } from '@/features/shell/components/page-kit';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';

const PROVIDERS: { value: AiProviderName | ''; label: string }[] = [
  { value: '', label: 'Environment variable default' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'ollama', label: 'Local LLM (Ollama)' },
];

interface AiSettingsForm {
  provider: string;
  model: string;
  baseUrl: string;
  temperature: string;
  maxTokens: string;
}

export default function PlatformAiSettingsPage() {
  const canManage = useHasPermission('settings:manage');

  const settings = usePlatformAiSettings();
  const updateSettings = useUpdatePlatformAiSettings();
  const resetSettings = useResetPlatformAiSettings();

  const [form, setForm] = React.useState<AiSettingsForm | null>(null);
  const [apiKeyInput, setApiKeyInput] = React.useState('');
  const [clearApiKey, setClearApiKey] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  React.useEffect(() => {
    if (settings.data && !form) {
      setForm({
        provider: settings.data.provider ?? '',
        model: settings.data.model ?? '',
        baseUrl: settings.data.baseUrl ?? '',
        temperature: settings.data.temperature != null ? String(settings.data.temperature) : '',
        maxTokens: settings.data.maxTokens != null ? String(settings.data.maxTokens) : '',
      });
    }
  }, [settings.data, form]);

  const handleSave = async () => {
    if (!form) return;
    try {
      await updateSettings.mutateAsync({
        provider: form.provider,
        model: form.model,
        baseUrl: form.baseUrl,
        temperature: form.temperature === '' ? undefined : Number(form.temperature),
        maxTokens: form.maxTokens === '' ? undefined : Number(form.maxTokens),
        ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : clearApiKey ? { apiKey: '' } : {}),
      });
      setApiKeyInput('');
      setClearApiKey(false);
      toast.success('AI settings saved.');
    } catch (error) {
      toast.error(toAdminServiceError(error).message);
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings.mutateAsync();
      setForm({ provider: '', model: '', baseUrl: '', temperature: '', maxTokens: '' });
      setApiKeyInput('');
      setClearApiKey(false);
      setConfirmReset(false);
      toast.success('Reverted to the environment-variable AI configuration.');
    } catch (error) {
      toast.error(toAdminServiceError(error).message);
    }
  };

  const d = settings.data;
  const dirty = !!form && !!d && (
    form.provider !== (d.provider ?? '') || form.model !== (d.model ?? '') || form.baseUrl !== (d.baseUrl ?? '') ||
    form.temperature !== (d.temperature != null ? String(d.temperature) : '') || form.maxTokens !== (d.maxTokens != null ? String(d.maxTokens) : '') ||
    apiKeyInput.trim() !== '' || clearApiKey
  );
  const providerLabel = PROVIDERS.find((p) => p.value === (d?.provider ?? ''))?.label ?? 'Environment variable default';

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <BackLink href="/settings">Back to Settings</BackLink>
      <Banner>
        <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">Bring your own AI provider key for the platform team&apos;s assistant, or leave blank to use the server&apos;s environment variables.</p>
      </Banner>

      {settings.isError ? <ErrorNote what="AI settings" message={settings.error?.message} onRetry={() => void settings.refetch()} /> : null}

      <KpiGrid>
        <KpiCard index={0} label="Provider" value={1} format={() => providerLabel} fallbackCaption={d?.provider ? 'saved override' : 'server default'} color="var(--chart-1)" />
        <KpiCard index={1} label="Model" value={1} format={() => d?.model || 'Default'} fallbackCaption="used for replies" color="var(--chart-2)" />
        <KpiCard index={2} label="API key" value={1} format={() => (d?.hasApiKey ? 'Stored' : 'Env var')} fallbackCaption={d?.hasApiKey ? `masked ${d.apiKeyMasked ?? ''}` : 'no key saved here'} color="var(--chart-6)" />
        <KpiCard index={3} label="Max tokens" value={d?.maxTokens ?? 0} format={(v) => (d?.maxTokens != null ? String(Math.round(v)) : 'Default')} fallbackCaption={d?.temperature != null ? `temperature ${d.temperature}` : 'default temperature'} color="var(--chart-4)" />
      </KpiGrid>

      {settings.isPending || !form ? (
        <Skeleton className="h-96 w-full rounded-[14px]" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel title="Provider & credentials" hint="shared across the admin team" index={0}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider" htmlFor="provider">
                  <select id="provider" className={FIELD} value={form.provider} disabled={!canManage} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                    {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Model" htmlFor="model">
                  <input id="model" className={FIELD} placeholder="e.g. google/gemma-4-31b-it:free" value={form.model} disabled={!canManage} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-[13px]">
                <span className="font-semibold">Key status</span>
                <Chip tone={clearApiKey ? 'amber' : d?.hasApiKey ? 'green' : 'slate'}>{clearApiKey ? 'Will be cleared on save' : d?.hasApiKey ? `Saved (${d.apiKeyMasked})` : 'Using environment variable'}</Chip>
              </div>
              <Field label="API key" htmlFor="apiKey" hint="Write-only — a saved key is never shown back.">
                <input
                  id="apiKey"
                  type="password"
                  autoComplete="off"
                  className={FIELD}
                  placeholder={clearApiKey ? 'Will be cleared on save' : d?.hasApiKey ? 'Enter a new key to replace the saved one' : 'Not set — using the environment variable key'}
                  value={apiKeyInput}
                  disabled={!canManage || clearApiKey}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </Field>
              {d?.hasApiKey && canManage ? (
                <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { setClearApiKey((v) => !v); setApiKeyInput(''); }}>
                  {clearApiKey ? 'Cancel clearing key' : 'Clear stored key'}
                </button>
              ) : null}
            </div>
          </Panel>

          <Panel title="Endpoint & generation" hint="blank = environment default" index={1}>
            <div className="space-y-4">
              <Field label="Base URL (optional)" htmlFor="baseUrl">
                <input id="baseUrl" className={FIELD} placeholder="Leave blank for the provider's default endpoint" value={form.baseUrl} disabled={!canManage} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Temperature (0–2)" htmlFor="temperature">
                  <input id="temperature" type="number" min={0} max={2} step={0.1} className={FIELD} placeholder="Default" value={form.temperature} disabled={!canManage} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
                </Field>
                <Field label="Max tokens" htmlFor="maxTokens">
                  <input id="maxTokens" type="number" min={1} max={32000} className={FIELD} placeholder="Default" value={form.maxTokens} disabled={!canManage} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })} />
                </Field>
              </div>
              {canManage ? (
                confirmReset ? (
                  <ConfirmRow text="Reset all AI settings (including the stored key) to the environment-variable default?" confirmLabel="Reset" busy={resetSettings.isPending} onCancel={() => setConfirmReset(false)} onConfirm={() => void handleReset()} />
                ) : (
                  <button type="button" className="text-sm text-destructive underline underline-offset-2 hover:opacity-80" onClick={() => setConfirmReset(true)}>Reset to environment-variable default</button>
                )
              ) : null}
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

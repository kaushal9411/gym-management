'use client';

import * as React from 'react';
import { Bot, KeyRound, Sparkles, Thermometer } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { toAuthServiceError } from '@/features/auth/services/api-client';
import { Field, PreviewCard, SectionCard, SettingsLayout, StatusChip } from '@/features/gym-settings/components/settings-ui';
import { SettingsHero } from '@/features/gym-settings/components/settings-hero';
import { StaggerGroup } from '@/features/reports/components/ui';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { useResetTenantAiSettings, useTenantAiSettings, useUpdateTenantAiSettings } from '@/features/ai-assistant/hooks/use-ai-assistant';
import type { AiProviderName } from '@/features/ai-assistant/types';
import { cn } from '@/lib/utils';

const PROVIDERS: { value: AiProviderName | ''; label: string }[] = [
  { value: '', label: 'Platform default' },
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

export default function AiSettingsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings:manage');

  const settings = useTenantAiSettings();
  const updateSettings = useUpdateTenantAiSettings();
  const resetSettings = useResetTenantAiSettings();

  const [form, setForm] = React.useState<AiSettingsForm | null>(null);
  const [apiKeyInput, setApiKeyInput] = React.useState('');
  const [clearApiKey, setClearApiKey] = React.useState(false);

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

  const baseline: AiSettingsForm | null = settings.data
    ? {
        provider: settings.data.provider ?? '',
        model: settings.data.model ?? '',
        baseUrl: settings.data.baseUrl ?? '',
        temperature: settings.data.temperature != null ? String(settings.data.temperature) : '',
        maxTokens: settings.data.maxTokens != null ? String(settings.data.maxTokens) : '',
      }
    : null;

  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline) || apiKeyInput.trim() !== '' || clearApiKey;
  const saving = updateSettings.isPending;

  const handleCancel = () => {
    if (baseline) setForm(baseline);
    setApiKeyInput('');
    setClearApiKey(false);
  };

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
      toast.error(toAuthServiceError(error).message);
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings.mutateAsync();
      setForm({ provider: '', model: '', baseUrl: '', temperature: '', maxTokens: '' });
      setApiKeyInput('');
      setClearApiKey(false);
      toast.success('Reverted to the platform default AI configuration.');
    } catch (error) {
      toast.error(toAuthServiceError(error).message);
    }
  };

  const tempNum = form && form.temperature !== '' ? Number(form.temperature) : null;
  const tempPct = tempNum !== null && Number.isFinite(tempNum) ? Math.min(100, Math.max(0, (tempNum / 2) * 100)) : null;
  const keyState = clearApiKey ? 'clearing' : apiKeyInput.trim() ? 'new' : settings.data?.hasApiKey ? 'saved' : 'none';
  const providerLabel = PROVIDERS.find((p) => p.value === form?.provider)?.label ?? 'Platform default';

  return (
    <div className="space-y-5">
      <SettingsHero
        title="AI Assistant"
        subtitle="Bring your own AI provider key, or leave blank to use the platform default."
        icon={Bot}
        stats={settings.data ? [{ label: 'Source', value: settings.data.usingPlatformDefault ? 'Platform' : 'Your own' }] : undefined}
      />

      {settings.isPending || !form ? (
        <Skeleton className="h-96 w-full rounded-[20px]" />
      ) : (
        <>
          {canManage ? <UnsavedChangesBar isDirty={isDirty} saving={saving} onSave={() => void handleSave()} onCancel={handleCancel} /> : null}

          <SettingsLayout
            aside={
              <StaggerGroup className="space-y-5">
                <PreviewCard title="Configuration summary" subtitle="Reflects the form; the key is never shown" icon={Sparkles} tone="analytics">
                  <dl className="space-y-1.5 text-sm">
                    {[
                      ['Provider', providerLabel],
                      ['Model', form.model || 'Platform default'],
                      ['Max tokens', form.maxTokens || 'Platform default'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                        <dt className="text-xs font-semibold text-muted-foreground">{k}</dt>
                        <dd className="truncate text-right font-bold">{v}</dd>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                      <dt className="text-xs font-semibold text-muted-foreground">API key</dt>
                      <dd>
                        <StatusChip tone={keyState === 'saved' || keyState === 'new' ? 'good' : 'muted'} icon={KeyRound}>
                          {keyState === 'saved' ? 'Key saved' : keyState === 'new' ? 'New key (unsaved)' : keyState === 'clearing' ? 'Will be cleared' : 'Not saved'}
                        </StatusChip>
                      </dd>
                    </div>
                  </dl>
                </PreviewCard>
              </StaggerGroup>
            }
          >
            <StaggerGroup className="space-y-5">
              <SectionCard
                tone="analytics"
                icon={Bot}
                title="Your own AI provider"
                subtitle={
                  <>
                    {settings.data?.usingPlatformDefault
                      ? "You're currently using FitCloud's shared platform AI configuration."
                      : "You're using your own AI provider configuration for this gym."}{' '}
                    Leave a field blank to fall back to the platform default for that field.
                  </>
                }
              >
                <div role="radiogroup" aria-label="Provider" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {PROVIDERS.map((p) => {
                    const active = form.provider === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!canManage}
                        onClick={() => setForm({ ...form, provider: p.value })}
                        className={cn(
                          'rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60',
                          active ? 'border-primary bg-primary/10 text-primary shadow-xs' : 'bg-muted/20 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm',
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <Field label="Model" htmlFor="model">
                  <Input id="model" placeholder="e.g. google/gemma-4-31b-it:free" value={form.model} disabled={!canManage} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                </Field>
              </SectionCard>

              <SectionCard tone="finance" icon={KeyRound} title="Credentials" subtitle="The key is stored encrypted and never displayed again." action={<StatusChip tone={keyState === 'saved' || keyState === 'new' ? 'good' : 'muted'}>{keyState === 'saved' ? 'Key saved' : keyState === 'new' ? 'New key entered' : keyState === 'clearing' ? 'Will be cleared' : 'Not saved'}</StatusChip>}>
                <Field label="API key" htmlFor="apiKey">
                  <Input
                    id="apiKey"
                    type="password"
                    autoComplete="off"
                    placeholder={clearApiKey ? 'Will be cleared on save' : settings.data?.hasApiKey ? `Using saved key (${settings.data.apiKeyMasked})` : 'Not set — using the platform key'}
                    value={apiKeyInput}
                    disabled={!canManage || clearApiKey}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                  />
                  {settings.data?.hasApiKey && canManage && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      onClick={() => {
                        setClearApiKey((v) => !v);
                        setApiKeyInput('');
                      }}
                    >
                      {clearApiKey ? 'Cancel clearing key' : 'Clear stored key'}
                    </button>
                  )}
                </Field>
                <Field label="Base URL (optional)" htmlFor="baseUrl">
                  <Input id="baseUrl" placeholder="Leave blank for the provider's default endpoint" value={form.baseUrl} disabled={!canManage} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
                </Field>
              </SectionCard>

              <SectionCard tone="operations" icon={Thermometer} title="Generation" subtitle="Creativity and response length.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Temperature (0–2)" htmlFor="temperature">
                    <Input id="temperature" type="number" min={0} max={2} step={0.1} placeholder="Platform default" value={form.temperature} disabled={!canManage} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
                    <div className="relative mt-2 h-2 rounded-full" style={{ backgroundImage: 'linear-gradient(90deg, var(--chart-2), var(--chart-3), var(--destructive))' }} aria-hidden>
                      {tempPct !== null ? (
                        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow-sm transition-all duration-300" style={{ left: `${tempPct}%` }} />
                      ) : null}
                    </div>
                    <div className="flex justify-between text-[10px] font-semibold text-muted-foreground" aria-hidden>
                      <span>Precise</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                  </Field>
                  <Field label="Max tokens" htmlFor="maxTokens">
                    <Input id="maxTokens" type="number" min={1} max={32000} placeholder="Platform default" value={form.maxTokens} disabled={!canManage} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })} />
                  </Field>
                </div>
                {canManage && !settings.data?.usingPlatformDefault && (
                  <button type="button" className="text-sm text-destructive underline underline-offset-2 hover:opacity-80" onClick={() => void handleReset()} disabled={resetSettings.isPending}>
                    Reset everything to the platform default
                  </button>
                )}
              </SectionCard>
            </StaggerGroup>
          </SettingsLayout>
        </>
      )}
    </div>
  );
}

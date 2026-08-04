'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toAdminServiceError } from '@/features/auth/services/api-client';
import { usePlatformAiSettings, useResetPlatformAiSettings, useUpdatePlatformAiSettings } from '@/features/ai-assistant/hooks/use-ai-assistant';
import type { AiProviderName } from '@/features/ai-assistant/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40',
);

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
      toast.success('Reverted to the environment-variable AI configuration.');
    } catch (error) {
      toast.error(toAdminServiceError(error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to Settings
        </Link>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Bot className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground">Bring your own AI provider key for the platform team&apos;s assistant, or leave blank to use the server&apos;s environment variables.</p>
        </div>
      </div>

      {settings.isPending || !form ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform AI provider</CardTitle>
            <CardDescription>Shared across the whole admin team. Leave a field blank to fall back to the environment-variable default for that field.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <select id="provider" className={selectClassName} value={form.provider} disabled={!canManage} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" placeholder="e.g. google/gemma-4-31b-it:free" value={form.model} disabled={!canManage} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API key</Label>
              <Input
                id="apiKey"
                type="password"
                autoComplete="off"
                placeholder={
                  clearApiKey
                    ? 'Will be cleared on save'
                    : settings.data?.hasApiKey
                      ? `Using saved key (${settings.data.apiKeyMasked})`
                      : 'Not set — using the environment variable key'
                }
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL (optional)</Label>
              <Input id="baseUrl" placeholder="Leave blank for the provider's default endpoint" value={form.baseUrl} disabled={!canManage} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature (0–2)</Label>
                <Input id="temperature" type="number" min={0} max={2} step={0.1} placeholder="Default" value={form.temperature} disabled={!canManage} onChange={(e) => setForm({ ...form, temperature: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max tokens</Label>
                <Input id="maxTokens" type="number" min={1} max={32000} placeholder="Default" value={form.maxTokens} disabled={!canManage} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })} />
              </div>
            </div>

            {canManage && (
              <div className="flex items-center justify-between pt-2">
                <button type="button" className="text-sm text-destructive underline underline-offset-2 hover:opacity-80" onClick={() => void handleReset()} disabled={resetSettings.isPending}>
                  Reset to environment-variable default
                </button>
                <Button onClick={() => void handleSave()} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

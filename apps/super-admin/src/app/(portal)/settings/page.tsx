'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bot, ChevronRight, Settings as SettingsIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toSettingsError, useSettings, useUpsertSetting } from '@/features/settings/hooks/use-settings';
import type { SystemSetting } from '@/features/settings/types';

/** Well-known settings this portal knows how to manage — "Company Information, SMTP, SMS Gateway, Payment Gateway Keys, Storage Provider, Cloudflare, AWS, Redis, Queue Settings, Maintenance Mode." */
const KNOWN_SETTINGS: Array<{ key: string; category: string; label: string; placeholder: string }> = [
  { key: 'company_info', category: 'company', label: 'Company Information', placeholder: '{ "name": "FitCloud Inc.", "supportEmail": "support@fitcloud.com" }' },
  { key: 'smtp', category: 'integrations', label: 'SMTP', placeholder: '{ "host": "smtp.example.com", "port": 587, "user": "...", "from": "no-reply@fitcloud.com" }' },
  { key: 'sms_gateway', category: 'integrations', label: 'SMS Gateway', placeholder: '{ "provider": "twilio", "accountSid": "...", "from": "+1..." }' },
  { key: 'payment_gateway_keys', category: 'integrations', label: 'Payment Gateway Keys', placeholder: '{ "stripe": { "publishableKey": "..." }, "razorpay": { "keyId": "..." } }' },
  { key: 'storage_provider', category: 'infrastructure', label: 'Storage Provider', placeholder: '{ "provider": "s3", "bucket": "fitcloud-uploads" }' },
  { key: 'cloudflare', category: 'infrastructure', label: 'Cloudflare Settings', placeholder: '{ "zoneId": "...", "apiToken": "***" }' },
  { key: 'aws', category: 'infrastructure', label: 'AWS Settings', placeholder: '{ "region": "us-east-1", "accessKeyId": "***" }' },
  { key: 'redis', category: 'infrastructure', label: 'Redis Settings', placeholder: '{ "maxConnections": 20 }' },
  { key: 'queue', category: 'infrastructure', label: 'Queue Settings', placeholder: '{ "concurrency": 5 }' },
  { key: 'maintenance_mode', category: 'platform', label: 'Maintenance Mode', placeholder: '{ "enabled": false, "message": "We will be back shortly." }' },
];

function SettingEditor({ meta, existing }: { meta: (typeof KNOWN_SETTINGS)[number]; existing: SystemSetting | undefined }) {
  const upsert = useUpsertSetting();
  const [text, setText] = React.useState(existing ? JSON.stringify(existing.value, null, 2) : '');
  const [error, setError] = React.useState<string | null>(null);

  const save = () => {
    let value: unknown;
    try {
      value = text.trim() ? JSON.parse(text) : {};
      setError(null);
    } catch {
      setError('Must be valid JSON.');
      return;
    }
    upsert.mutate(
      { key: meta.key, category: meta.category, value },
      { onSuccess: () => toast.success(`${meta.label} saved`), onError: (err) => toast.error(toSettingsError(err).message) },
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{meta.label}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <textarea
          className="h-28 w-full rounded-md border border-input bg-background p-2 font-mono text-xs shadow-sm"
          placeholder={meta.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{existing ? `Updated ${new Date(existing.updatedAt).toLocaleString()}` : 'Not configured yet'}</p>
          <Button size="sm" onClick={save} disabled={upsert.isPending}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();

  if (isLoading || !settings) return <Skeleton className="h-96 rounded-xl" />;

  const byKey = new Map(settings.map((s) => [s.key, s]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
          <SettingsIcon className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">System configuration — stored as key-value JSON, editable per integration.</p>
        </div>
      </div>

      <Link href="/settings/ai" className="block">
        <Card className="transition-colors hover:bg-accent/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-4.5" aria-hidden />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">AI Assistant</p>
              <p className="text-xs text-muted-foreground">Bring your own provider key for the platform team&apos;s AI assistant.</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </CardContent>
        </Card>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {KNOWN_SETTINGS.map((meta) => <SettingEditor key={meta.key} meta={meta} existing={byKey.get(meta.key)} />)}
      </div>
    </div>
  );
}

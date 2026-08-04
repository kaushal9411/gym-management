'use client';

import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiConfig } from '../hooks/use-ai-assistant';

/**
 * Read-only — the backend only exposes "Get AI Configuration", never an
 * update endpoint (provider/model/key/temperature/max-tokens are env-var
 * only, per the module's "never hardcode, configure via environment"
 * requirement). This just surfaces what's currently active so a staff
 * member isn't left guessing why the assistant is unavailable.
 */
export function AiSettingsDialog() {
  const { data: config, isLoading } = useAiConfig();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="AI assistant settings">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Assistant configuration</DialogTitle>
          <DialogDescription>Set by your platform administrator via environment variables — not editable here.</DialogDescription>
        </DialogHeader>
        {isLoading || !config ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : (
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd className={config.isConfigured ? 'text-success' : 'text-destructive'}>{config.isConfigured ? 'Configured' : 'Not configured'}</dd>
            <dt className="text-muted-foreground">Provider</dt>
            <dd className="capitalize">{config.provider}</dd>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="truncate font-mono text-xs">{config.model}</dd>
            <dt className="text-muted-foreground">Temperature</dt>
            <dd>{config.temperature}</dd>
            <dt className="text-muted-foreground">Max tokens</dt>
            <dd>{config.maxTokens}</dd>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}

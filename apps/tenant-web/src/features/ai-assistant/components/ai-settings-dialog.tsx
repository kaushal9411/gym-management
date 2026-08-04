'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useAiConfig } from '../hooks/use-ai-assistant';

/**
 * Read-only quick view — the ACTUAL editable form lives at
 * `/gym-settings/ai` ("bring your own key" per-tenant override); this
 * dialog just surfaces what's currently active (platform default or this
 * tenant's own key) plus a shortcut to that page, so a staff member isn't
 * left guessing why the assistant is unavailable mid-chat.
 */
export function AiSettingsDialog() {
  const { data: config, isLoading } = useAiConfig();
  const { hasPermission } = usePermissions();

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
          <DialogDescription>
            {config?.usingOwnKey ? "Using this gym's own AI provider key." : "Using FitCloud's shared platform AI configuration."}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !config ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd className={config.isConfigured ? 'text-success' : 'text-destructive'}>{config.isConfigured ? 'Configured' : 'Not configured'}</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>{config.usingOwnKey ? 'Your own key' : 'Platform default'}</dd>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="capitalize">{config.provider}</dd>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="truncate font-mono text-xs">{config.model}</dd>
              <dt className="text-muted-foreground">Temperature</dt>
              <dd>{config.temperature}</dd>
              <dt className="text-muted-foreground">Max tokens</dt>
              <dd>{config.maxTokens}</dd>
            </dl>
            {hasPermission('settings:manage') && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/gym-settings/ai">Manage AI provider settings</Link>
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import * as React from 'react';
import { Bot } from 'lucide-react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AiChatPanel } from './ai-chat-panel';

/**
 * Global floating entry point — mounted once in `app-providers.tsx`, same
 * pattern as `<GlobalLoader/>`/`<SessionExpiryModal/>`. Gated on BOTH the
 * `ai_coach` plan feature flag AND the `ai:use` permission, same two-check
 * pattern `/support`'s page uses for its own plan-gated section (feature
 * flag = "is this on the tenant's plan", permission = "can THIS user use
 * it") — renders nothing at all rather than a disabled/greyed-out button
 * when either check fails, so its absence doesn't hint at a feature the
 * user isn't entitled to.
 */
export function AiLauncherButton() {
  const [open, setOpen] = React.useState(false);
  const { isAuthenticated } = useAuth();
  const tenant = useTenant();
  const { hasPermission } = usePermissions();

  const isEnabled = isAuthenticated && tenant.featureFlags.includes('ai_coach') && hasPermission('ai:use');
  if (!isEnabled) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open AI Business Assistant"
      >
        <Bot className="size-6" aria-hidden />
      </button>
      <AiChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

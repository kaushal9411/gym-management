'use client';

import * as React from 'react';
import { Bot } from 'lucide-react';

import { useAuth, useHasPermission } from '@/features/auth/hooks/use-auth';
import { AiChatPanel } from './ai-chat-panel';

/**
 * Global floating entry point — mounted once in `app-providers.tsx`, same
 * pattern as tenant-web's launcher. Gated on `dashboard:read` (matches the
 * backend router's gate) — every admin role has this, so effectively
 * "any logged-in admin can use it."
 */
export function AiLauncherButton() {
  const [open, setOpen] = React.useState(false);
  const { isAuthenticated } = useAuth();
  const canUse = useHasPermission('dashboard:read');

  if (!isAuthenticated || !canUse) return null;

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

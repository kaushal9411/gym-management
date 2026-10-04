'use client';

import { Bell, Info } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { AccentPanel } from './settings-ui';

// Static preview only (same three items as before): nothing here is read from or saved to the API.
const PREFS = [
  { key: 'email-billing', label: 'Billing & subscription emails' },
  { key: 'email-announcements', label: 'Platform announcements' },
  { key: 'inapp-system', label: 'In-app system alerts' },
] as const;

export function NotificationsTab() {
  return (
    <AccentPanel title="Notification preferences" subtitle="Read-only preview. These toggles are not saved." icon={Bell} accent="analytics">
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          You cannot change them on this page. Your real notification preferences live on your{' '}
          <Link href="/profile#notifications" className="font-bold text-primary underline-offset-4 hover:underline">profile</Link>.
        </span>
      </p>
      <ul className="space-y-2">
        {PREFS.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 opacity-80">
            <span id={p.key} className="text-sm font-semibold">{p.label}</span>
            <span role="switch" aria-checked="true" aria-disabled="true" aria-labelledby={p.key} className={cn('relative h-6 w-[42px] shrink-0 rounded-full bg-primary/50')}>
              <span className="absolute right-[3px] top-[3px] size-[18px] rounded-full bg-white" />
            </span>
          </li>
        ))}
      </ul>
    </AccentPanel>
  );
}

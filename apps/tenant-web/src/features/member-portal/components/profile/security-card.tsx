'use client';

import * as React from 'react';
import { ChevronDown, KeyRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MemberChangePasswordForm } from '../member-change-password-form';
import { SectionCard } from '../kit';

/** Security card — the password form is collapsed behind a tap target (keeps the phone page short). */
export function SecurityCard() {
  const [open, setOpen] = React.useState(false);
  return (
    <SectionCard title="Security" subtitle="Password & signed-in devices" icon={KeyRound} tone="warning">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="change-password-panel"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl text-left text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Change password
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id="change-password-panel" className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">Your other signed-in devices will be signed out.</p>
          <MemberChangePasswordForm />
        </div>
      ) : null}
    </SectionCard>
  );
}

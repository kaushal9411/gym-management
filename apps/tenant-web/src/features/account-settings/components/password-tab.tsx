'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';

import { ChangePasswordForm } from '@/features/auth/components/forms/change-password-form';
import { AccentPanel } from './settings-ui';

/** Form (with its built-in strength meter + policy checklist) is unchanged; only the shell is new. */
export function PasswordTab() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AccentPanel className="lg:col-span-2" title="Change password" subtitle="Changing your password signs you out of every other session." icon={KeyRound} accent="staff">
        <div className="max-w-xl">
          <ChangePasswordForm />
        </div>
      </AccentPanel>
      <AccentPanel title="Good habits" icon={ShieldCheck} accent="finance">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Use a password you do not use anywhere else.</li>
          <li>A long phrase beats a short complex one.</li>
          <li>Pair it with two-factor authentication on the Security tab.</li>
        </ul>
      </AccentPanel>
    </div>
  );
}

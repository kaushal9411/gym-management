'use client';

import { motion } from 'framer-motion';
import { KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DisableTwoFactorDialog } from '@/features/auth/components/disable-two-factor-dialog';
import { EnableTwoFactorDialog } from '@/features/auth/components/enable-two-factor-dialog';
import { RegenerateBackupCodesDialog } from '@/features/auth/components/regenerate-backup-codes-dialog';
import { useIamProfile } from '@/features/iam/hooks/use-iam';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { AccentPanel } from './settings-ui';

/** Self-service TOTP 2FA. Dialogs are the unchanged auth-feature components (open state lives here). */
export function SecurityTab() {
  const profile = useIamProfile();
  const m = useMotionSafe();
  const [enableOpen, setEnableOpen] = React.useState(false);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [regenerateOpen, setRegenerateOpen] = React.useState(false);
  const on = profile.data?.mfaEnabled ?? false;
  const color = on ? 'var(--success)' : 'var(--destructive)';
  const Icon = on ? ShieldCheck : ShieldAlert;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <AccentPanel className="lg:col-span-2" title="Two-factor authentication" subtitle="Require a code from an authenticator app in addition to your password." icon={ShieldCheck} accent="finance">
        {profile.isPending ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            <motion.span
              key={String(on)}
              initial={m.reduce ? false : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="flex size-20 shrink-0 items-center justify-center rounded-3xl"
              style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`, color }}
            >
              <Icon className="size-10" aria-hidden />
            </motion.span>
            <div className="min-w-[200px] flex-1">
              <span className="inline-flex rounded-full px-3 py-1 text-sm font-extrabold" style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`, color }}>
                {on ? 'Enabled' : 'Disabled'}
              </span>
              <p className="mt-2 text-sm text-muted-foreground">{on ? 'Your account asks for an authenticator code at sign-in.' : 'Your account is protected by a password only.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {on ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>Regenerate backup codes</Button>
                    <Button variant="destructive" size="sm" onClick={() => setDisableOpen(true)}>Disable 2FA</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setEnableOpen(true)}>Enable 2FA</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </AccentPanel>
      <AccentPanel title="Backup codes" icon={KeyRound} accent="attendance">
        <p className="text-sm text-muted-foreground">Backup codes are shown once when you enable 2FA or regenerate them. Each works a single time if you lose your authenticator app. Regenerating invalidates the old set.</p>
      </AccentPanel>

      <EnableTwoFactorDialog open={enableOpen} onOpenChange={setEnableOpen} />
      <DisableTwoFactorDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <RegenerateBackupCodesDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
    </div>
  );
}

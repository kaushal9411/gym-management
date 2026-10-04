'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Globe, History, LogOut, Monitor, MonitorSmartphone, Smartphone, Tablet } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogoutAllDevices } from '@/features/auth/hooks/use-logout';
import { toIamError, useActiveSessions, useLoginHistory, useRevokeSession } from '@/features/iam/hooks/use-iam';
import { KpiTile, StaggerGroup } from '@/features/reports/components/ui';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { AccentPanel, fmtWhen } from './settings-ui';

function deviceIcon(ua: string | null) {
  const s = (ua ?? '').toLowerCase();
  if (/ipad|tablet/.test(s)) return Tablet;
  if (/iphone|android|mobile/.test(s)) return Smartphone;
  if (s) return Monitor;
  return MonitorSmartphone;
}

export function SessionsTab() {
  const m = useMotionSafe();
  const sessions = useActiveSessions();
  const revokeSession = useRevokeSession();
  const { logoutAllDevices, isLoggingOut } = useLogoutAllDevices();
  const history = useLoginHistory({ limit: 10 });
  const items = history.data?.items ?? [];
  const ok = items.filter((e) => e.success).length;

  return (
    <div className="space-y-4">
      <StaggerGroup className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <KpiTile label="Active sessions" value={sessions.data?.length ?? 0} icon={MonitorSmartphone} accent="operations" loading={sessions.isPending} />
        <KpiTile label="Recent sign-ins" value={ok} icon={History} accent="finance" hint="successful, last 10" loading={history.isPending} />
        <KpiTile label="Failed attempts" value={items.length - ok} icon={LogOut} accent="staff" hint="last 10" loading={history.isPending} />
      </StaggerGroup>

      <AccentPanel
        title="Active sessions"
        subtitle="Devices currently signed in to your account."
        icon={MonitorSmartphone}
        accent="operations"
        action={<Button variant="outline" size="sm" disabled={isLoggingOut} onClick={() => logoutAllDevices()}><LogOut className="size-4" /> Sign out everywhere</Button>}
      >
        {sessions.isPending ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : (sessions.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <motion.ul className="grid grid-cols-1 gap-3 xl:grid-cols-2" variants={m.staggerContainer(0.07)} initial={m.initial} animate="show">
            <AnimatePresence>
              {(sessions.data ?? []).map((s) => {
                const Icon = deviceIcon(s.userAgent);
                return (
                  <motion.li key={s.id} variants={m.fadeUp} exit={{ opacity: 0 }} whileHover={m.reduce ? undefined : { y: -2 }} className="flex items-center gap-3 rounded-2xl border p-3.5 shadow-xs transition-shadow hover:shadow-md">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        <span className="truncate">{s.deviceLabel ?? s.userAgent ?? 'Unknown device'}</span>
                        {s.isCurrent ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-extrabold text-success">This device</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{s.ipAddress ?? 'Unknown IP'} · Active {fmtWhen(s.lastActiveAt)}</p>
                    </div>
                    {!s.isCurrent ? (
                      <Button variant="outline" size="sm" disabled={revokeSession.isPending} onClick={() => revokeSession.mutate(s.id, { onSuccess: () => toast.success('Session revoked'), onError: (err) => toast.error(toIamError(err).message) })}>Revoke</Button>
                    ) : null}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </AccentPanel>

      <AccentPanel title="Login history" subtitle="Recent sign-in attempts on your account." icon={History} accent="members">
        {history.isPending ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No login history yet.</p>
        ) : (
          <motion.ol className="relative space-y-3" variants={m.staggerContainer(0.05)} initial={m.initial} animate="show">
            <span aria-hidden className="absolute bottom-2 left-[13px] top-2 w-px bg-border" />
            {items.map((e) => {
              const c = e.success ? 'var(--success)' : 'var(--destructive)';
              return (
                <motion.li key={e.id} variants={m.listItem} className="relative flex items-start gap-3">
                  <span className="z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card" style={{ backgroundColor: `color-mix(in oklch, ${c} 18%, transparent)`, color: c }}>
                    <Globe className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {e.success ? 'Successful sign-in' : 'Failed sign-in'}
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ backgroundColor: `color-mix(in oklch, ${c} 15%, transparent)`, color: c }}>{e.success ? 'Success' : e.reason ?? 'Failed'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{e.ipAddress ?? 'Unknown IP'} · {fmtWhen(e.createdAt)}</p>
                  </div>
                </motion.li>
              );
            })}
          </motion.ol>
        )}
      </AccentPanel>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

import type { DashboardOverview } from '@/features/dashboard/types';
import { cn } from '@/lib/utils';

/** Environment from NEXT_PUBLIC_APP_ENV, else derived from the hostname. Client-only (hostname) to stay hydration-safe. */
function useEnvName(): string | null {
  const [env, setEnv] = useState<string | null>(null);
  useEffect(() => {
    const configured = process.env.NEXT_PUBLIC_APP_ENV;
    const h = window.location.hostname;
    setEnv(configured ? configured.charAt(0).toUpperCase() + configured.slice(1) : h === 'localhost' || h === '127.0.0.1' ? 'Development' : 'Production');
  }, []);
  return env;
}

/** "Env · all systems normal" only when overview health says so; otherwise just the env name. */
export function EnvBadge({ health }: { health: DashboardOverview['health'] | undefined }) {
  const env = useEnvName();
  if (!env) return null;
  const ok = (s: string) => s === 'up' || s === 'healthy' || s === 'ok';
  const known = !!health;
  const normal = known && ok(health.database.status) && ok(health.redis.status) && health.queue?.health !== 'unhealthy';
  return (
    <span
      className={cn(
        'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold lg:inline-flex',
        !known ? 'bg-muted text-muted-foreground' : normal ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
      )}
    >
      <i className={cn('size-[7px] rounded-full', !known ? 'bg-slate-400' : normal ? 'bg-green-600 dark:bg-green-400' : 'bg-amber-500')} aria-hidden />
      {known ? `${env} · ${normal ? 'all systems normal' : 'degraded'}` : env}
    </span>
  );
}

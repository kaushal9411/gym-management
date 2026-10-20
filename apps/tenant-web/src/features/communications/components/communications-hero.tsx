'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Clock3, Send, Zap } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { COMM_ACCENT } from '@/features/notifications/constants';
import { ReportsHero } from '@/features/reports/components/ui';
import { CHANNEL_META, COMMUNICATIONS_PERMISSIONS, COMMUNICATIONS_ROUTES } from '../constants';
import { useCommunicationsOverview } from '../hooks/use-communications';
import { describeLoadError } from '../lib/errors';
import type { ChannelQuotaOverview } from '../types';

function QuotaChip({ q }: { q: ChannelQuotaOverview }) {
  const meta = CHANNEL_META[q.channel];
  const off = !q.enabled;
  const pct = q.limit ? Math.min(100, (q.used / q.limit) * 100) : 0;
  return (
    <li className="min-w-[132px] rounded-xl border border-white/25 bg-white/14 px-3 py-2 backdrop-blur-sm">
      <small className="block text-[11px] font-semibold uppercase tracking-wider text-white/80">{meta.label}</small>
      <b className="text-[15px] tabular-nums">{off ? (q.disabledReason === 'disabled_platform' ? 'Not on your plan' : 'Switched off') : `${(q.remaining ?? 0).toLocaleString('en-IN')} left`}</b>
      {!off ? (
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/25"
          role="progressbar"
          aria-label={`${meta.label} used this month`}
          aria-valuemin={0}
          aria-valuemax={q.limit ?? 0}
          aria-valuenow={q.used}
        >
          <i className="block h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </li>
  );
}

/** Quota chips from `GET /communications/overview`: limited channels each get a meter; unlimited ones are grouped like the design. */
function QuotaStrip() {
  const { data, isLoading, isError, error, refetch } = useCommunicationsOverview();

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[58px] w-[132px] rounded-xl bg-white/20" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div role="alert" className="rounded-xl border border-white/25 bg-white/14 px-3 py-2 text-[13px]">
        <p className="font-semibold">Channel limits are unavailable</p>
        <p className="text-white/85">{describeLoadError(error, 'your channel limits')}</p>
        <button type="button" onClick={() => void refetch()} className="mt-1 inline-flex min-h-8 items-center rounded-md font-bold underline underline-offset-2">
          Try again
        </button>
      </div>
    );
  }
  const limited = data.channels.filter((c) => c.channel === 'EMAIL' || c.channel === 'SMS' || c.channel === 'WHATSAPP');
  return (
    <ul className="flex flex-wrap gap-2.5" aria-label={`Channel limits for ${data.periodKey}`}>
      {limited.map((q) => (
        <QuotaChip key={q.channel} q={q} />
      ))}
      <li className="min-w-[132px] rounded-xl border border-white/25 bg-white/14 px-3 py-2 backdrop-blur-sm">
        <small className="block text-[11px] font-semibold uppercase tracking-wider text-white/80">Push and in-app</small>
        <b className="text-[15px]">No limit</b>
        <div className="mt-1.5 h-1 rounded-full bg-white/25">
          <i className="block h-full w-[6%] rounded-full bg-white" />
        </div>
      </li>
    </ul>
  );
}

/** Shared hero of every /communications/* page: title, live channel limits and the three route tabs (Send tab only with `notifications:send`). */
export function CommunicationsHero() {
  const { hasPermission } = usePermissions();
  const canSend = hasPermission(COMMUNICATIONS_PERMISSIONS.send);
  const pathname = usePathname();
  const activeTab = pathname.startsWith(COMMUNICATIONS_ROUTES.automations) ? 'automations' : pathname.startsWith(COMMUNICATIONS_ROUTES.history) ? 'history' : 'send';

  return (
    <ReportsHero
      eyebrow="Communication"
      title="Communications"
      subtitle="Message the right members on the right channel, and let reminders run on their own."
      accent={COMM_ACCENT}
      icon={Send}
      aside={<QuotaStrip />}
      activeTab={activeTab}
      tabs={[
        ...(canSend ? [{ value: 'send', label: 'Send message', icon: Send, href: COMMUNICATIONS_ROUTES.send }] : []),
        { value: 'automations', label: 'Automations', icon: Zap, href: COMMUNICATIONS_ROUTES.automations },
        { value: 'history', label: 'History', icon: Clock3, href: COMMUNICATIONS_ROUTES.history },
      ]}
    />
  );
}

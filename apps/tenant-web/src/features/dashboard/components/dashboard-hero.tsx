'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { CircleCheck, UserPlus, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { CountUp } from '@/features/members/components/detail/detail-ui';
import { useKpis } from '@/features/reports/hooks/use-reports';
import { useTenant } from '@/features/tenant/tenant-provider';
import { useCurrencySymbol } from '@/lib/currency';
import { DateRangeSelector } from './date-range-selector';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHero() {
  const user = useCurrentUser();
  const tenant = useTenant();
  const symbol = useCurrencySymbol();
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const kpis = useKpis(currentBranchId ?? undefined).data;
  const bannerUrl = tenant.branding.dashboardBannerUrl;
  const canSeeKpis = hasPermission('reports:view');

  const today = [
    { label: 'Check-ins today', value: kpis?.todaysAttendance ?? 0, tone: 'var(--chart-3)', prefix: '' },
    { label: 'Expiring in 30 days', value: kpis?.expiringMemberships ?? 0, tone: 'var(--warning)', prefix: '' },
    { label: 'Due now', value: Math.round(Number(kpis?.outstandingPayments ?? 0)), tone: 'var(--destructive)', prefix: symbol },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative grid gap-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-7"
      style={{
        backgroundImage: bannerUrl
          ? `url(${bannerUrl})`
          : 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {bannerUrl ? <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-indigo-950/80 via-indigo-900/55 to-fuchsia-900/60" /> : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }}
      />

      <div className="relative min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="mt-1 text-balance text-2xl font-extrabold tracking-tight sm:text-4xl">
          {greeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-white/85">Here&apos;s how {tenant.name} is doing today.</p>

        <div className="mt-4 inline-flex rounded-xl border border-white/25 bg-white/15 p-0.5 backdrop-blur [&>div]:bg-transparent [&_button]:text-white/90 [&_button[class*='bg-background']]:bg-white [&_button[class*='bg-background']]:text-indigo-700">
          <DateRangeSelector />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {hasPermission('members:create') ? (
            <Button asChild size="sm" variant="secondary" className="border border-white/30 bg-white/15 text-white hover:bg-white/25">
              <Link href="/members/new">
                <UserPlus className="size-4" /> Add member
              </Link>
            </Button>
          ) : null}
          {hasPermission('finance:view') ? (
            <Button asChild size="sm" variant="secondary" className="border border-white/30 bg-white/15 text-white hover:bg-white/25">
              <Link href="/payments">
                <Wallet className="size-4" /> Record payment
              </Link>
            </Button>
          ) : null}
          {hasPermission('attendance:view') ? (
            <Button asChild size="sm" variant="secondary" className="border border-white/30 bg-white/15 text-white hover:bg-white/25">
              <Link href="/attendance">
                <CircleCheck className="size-4" /> Check in
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {canSeeKpis ? (
        <div className="relative grid grid-cols-3 gap-2.5" aria-label="Today at a glance">
          {today.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className="min-w-[96px] rounded-2xl bg-white/95 p-3.5 text-slate-900 shadow-xl"
            >
              <span className="mb-2 block h-1 w-7 rounded-full" style={{ backgroundColor: t.tone }} />
              <b className="block text-3xl font-extrabold leading-tight tabular-nums">
                {t.prefix}
                <CountUp value={t.value} format={(n) => Math.round(n).toLocaleString()} />
              </b>
              <span className="text-xs font-medium text-slate-500">{t.label}</span>
            </motion.div>
          ))}
        </div>
      ) : null}
    </motion.section>
  );
}

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { useTenantOverview } from '@/features/tenants/api/detail';
import { OverviewTab } from '../overview/overview-tab';
import { ReportsTab } from '../reports/reports-tab';
import { ActivityTab } from '../tabs/activity-tab';
import { BillingTab } from '../tabs/billing-tab';
import { SubscriptionTab } from '../tabs/subscription-tab';
import { SupportTab } from '../tabs/support-tab';
import { UsersTab } from '../tabs/users-tab';
import { ModulesTab } from '../modules-tab';
import { NotificationChannelsTab } from '../notification-channels-tab';
import { UsageLimitsTab } from '../usage-limits-tab';
import { TabBar, type TabDef } from './tab-bar';
import { TenantBanner } from './tenant-banner';

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' }, { id: 'reports', label: 'Reports' }, { id: 'subscription', label: 'Subscription' }, { id: 'usage', label: 'Usage & limits' },
  { id: 'modules', label: 'Modules' }, { id: 'notifications', label: 'Notification channels' }, { id: 'billing', label: 'Billing' }, { id: 'users', label: 'Users' }, { id: 'activity', label: 'Activity' }, { id: 'support', label: 'Support' },
];
const IDS = new Set(TABS.map((t) => t.id));

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading tenant">
      <div className="h-[104px] animate-pulse rounded-[18px] bg-muted" />
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[92px] animate-pulse rounded-[14px] bg-muted" />)}</div>
      <div className="h-72 animate-pulse rounded-[14px] bg-muted" />
    </div>
  );
}

function View({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const reduce = useReducedMotion();
  const canManage = useHasPermission('tenants:manage');
  const q = useTenantOverview(tenantId);

  const raw = sp.get('tab') ?? 'overview';
  const tab = IDS.has(raw) ? raw : 'overview';
  const setTab = (id: string) => {
    if (id === tab) return;
    const next = new URLSearchParams(sp.toString());
    if (id === 'overview') next.delete('tab'); else next.set('tab', id);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-[14px] border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Tenant not found</h1>
        <p className="text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : 'This tenant does not exist or could not be loaded.'}</p>
        <div className="flex justify-center gap-2">
          <Link href="/tenants" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden />Back to tenants</Link>
          <button type="button" onClick={() => void q.refetch()} className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"><RefreshCw className="size-4" aria-hidden />Retry</button>
        </div>
      </div>
    );
  }

  const t = q.data.tenant;
  const props = { tenantId, tenantSlug: t.slug, tenantName: t.name, canManage };
  const content = (() => {
    switch (tab) {
      case 'reports': return <ReportsTab {...props} />;
      case 'subscription': return <SubscriptionTab {...props} />;
      case 'usage': return <UsageLimitsTab {...props} />;
      case 'modules': return <ModulesTab {...props} />;
      case 'notifications': return <NotificationChannelsTab {...props} />;
      case 'billing': return <BillingTab {...props} />;
      case 'users': return <UsersTab {...props} />;
      case 'activity': return <ActivityTab {...props} />;
      case 'support': return <SupportTab {...props} />;
      default: return <OverviewTab tenantId={tenantId} canManage={canManage} onOpenTab={setTab} />;
    }
  })();

  return (
    <div className="space-y-4">
      <TenantBanner tenant={t} canManage={canManage} onChangePlan={() => setTab('subscription')} />
      <TabBar tabs={TABS} active={tab} onChange={setTab} idPrefix="tenant" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          id={`tenant-panel-${tab}`}
          aria-labelledby={`tenant-tab-${tab}`}
          tabIndex={-1}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="outline-none"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function TenantDetailView({ tenantId }: { tenantId: string }) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <View tenantId={tenantId} />
    </Suspense>
  );
}

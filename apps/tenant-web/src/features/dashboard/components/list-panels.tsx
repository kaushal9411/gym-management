'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, Clock, CreditCard, Send, UserCheck, UserPlus, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { useInvoiceList } from '@/features/finance/hooks/use-finance';
import { type Accent, PanelCard, accentVar, formatMoney, tint } from '@/features/members/components/detail/detail-ui';
import { isPaginated, useRecentActivities, useReportData } from '@/features/reports/hooks/use-reports';
import { useCurrencySymbol } from '@/lib/currency';
import { formatRelativeTime } from '@/lib/format-relative-time';

const AVATAR_TONES: Accent[] = ['primary', 'violet', 'aqua', 'warning', 'destructive', 'success'];

function Avatar({ name, index }: { name: string; index: number }) {
  const accent = AVATAR_TONES[index % AVATAR_TONES.length]!;
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white"
      style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(accent)}, color-mix(in oklch, ${accentVar(accent)} 50%, var(--chart-7)))` }}
    >
      {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
  );
}

function Row({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index }}
      className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition-all hover:translate-x-0.5 hover:bg-accent/50"
    >
      {children}
    </motion.div>
  );
}

interface ExpiringRow {
  memberCode: string;
  name: string;
  plan: string;
  endDate: string;
  daysRemaining: number;
}

export function ExpiringPanel() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const report = useReportData<ExpiringRow>('expiring-memberships', { limit: 6, branchId: currentBranchId ?? undefined });
  if (!hasPermission('reports:view')) return null;

  const rows = isPaginated(report.data) ? report.data.items : ((report.data as ExpiringRow[] | undefined) ?? []);

  return (
    <PanelCard icon={Clock} accent="warning" title="Expiring memberships" delay={0.5} right={<Link href="/reports" className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>View all</Link>}>
      <div className="-my-1.5 flex flex-col">
        {report.isPending ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="my-1 h-10 w-full" />)
        ) : rows.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing expiring soon" />
        ) : (
          rows.map((r, i) => (
            <Row key={r.memberCode} index={i}>
              <Avatar name={r.name} index={i} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.plan} · {r.daysRemaining <= 0 ? 'ends today' : r.daysRemaining === 1 ? 'ends tomorrow' : `ends in ${r.daysRemaining} days`}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums"
                style={{ backgroundColor: tint(r.daysRemaining <= 3 ? 'destructive' : 'warning', 14), color: r.daysRemaining <= 3 ? 'var(--destructive)' : 'var(--warning)' }}
              >
                {r.daysRemaining}d
              </span>
            </Row>
          ))
        )}
      </div>
    </PanelCard>
  );
}

export function OutstandingPanel() {
  const symbol = useCurrencySymbol();
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const branchId = currentBranchId ?? undefined;
  const unpaid = useInvoiceList({ page: 1, limit: 6, status: 'UNPAID', sortBy: 'dueDate', sortDir: 'asc', branchId });
  const overdue = useInvoiceList({ page: 1, limit: 6, status: 'OVERDUE', sortBy: 'dueDate', sortDir: 'asc', branchId });
  if (!hasPermission('finance:view')) return null;

  const items = [...(overdue.data?.items ?? []), ...(unpaid.data?.items ?? [])].slice(0, 6);
  const total = items.reduce((s, i) => s + Number(i.totalAmount), 0);
  const loading = unpaid.isPending || overdue.isPending;

  return (
    <PanelCard
      icon={Wallet}
      accent="destructive"
      title="Outstanding payments"
      delay={0.56}
      right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint('destructive', 14), color: 'var(--destructive)' }}>{formatMoney(symbol, total)}</span>}
    >
      <div className="-my-1.5 flex flex-col">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="my-1 h-10 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={CreditCard} title="Nothing outstanding" />
        ) : (
          items.map((inv, i) => {
            const isOverdue = inv.status === 'OVERDUE' || new Date(inv.dueDate) < new Date(new Date().toDateString());
            return (
              <Row key={inv.id} index={i}>
                <Avatar name={inv.member.name} index={i + 2} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">{inv.member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {inv.invoiceNumber} · {isOverdue ? 'overdue since' : 'due'} {new Date(inv.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <b className="tabular-nums" style={{ color: 'var(--destructive)' }}>{formatMoney(symbol, inv.totalAmount)}</b>
                <Button asChild size="icon" variant="outline" className="size-8" title="Open member to send a payment link">
                  <Link href={`/members/${inv.member.id}`}>
                    <Send className="size-3.5" />
                  </Link>
                </Button>
              </Row>
            );
          })
        )}
      </div>
    </PanelCard>
  );
}

const ACTIVITY_ICON = { PAYMENT: Wallet, CHECK_IN: UserCheck, NEW_MEMBER: UserPlus } as const;
const ACTIVITY_TONE: Record<keyof typeof ACTIVITY_ICON, Accent> = { PAYMENT: 'success', CHECK_IN: 'aqua', NEW_MEMBER: 'violet' };

export function ActivityPanel() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const { data, isPending } = useRecentActivities(currentBranchId ?? undefined);
  if (!hasPermission('reports:view')) return null;
  const items = data ?? [];

  return (
    <PanelCard icon={Activity} accent="primary" title="Live activity" delay={0.62}>
      <div className="-my-1.5 flex flex-col">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="my-1 h-10 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Activity} title="No recent activity" />
        ) : (
          items.slice(0, 6).map((item, i) => {
            const Icon = ACTIVITY_ICON[item.type];
            const tone = ACTIVITY_TONE[item.type];
            return (
              <Row key={`${item.type}-${item.id}`} index={i}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tint(tone, 16), color: accentVar(tone) }}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detail} · {formatRelativeTime(item.occurredAt)}
                  </p>
                </div>
              </Row>
            );
          })
        )}
      </div>
    </PanelCard>
  );
}

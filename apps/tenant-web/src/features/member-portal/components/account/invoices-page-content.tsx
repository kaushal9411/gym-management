'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, Download, Receipt, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { useMemberInvoices, useMemberOverview } from '../../hooks/use-member-portal';
import { formatDate, parseMoney, plural, usePortalMoney } from '../../lib/format';
import { memberPortalService } from '../../services/member-portal.service';
import { EmptyBlock, HeroChip, PortalHero, SkeletonCard, SkeletonHero, StatusChip, heroActionClass } from '../kit';
import { toneColor, toneTint } from '../kit/tones';
import { PayInvoiceButton } from '../pay-invoice-button';
import { INVOICE_STATUS, dueChip, isOpenInvoice } from './invoice-utils';

type Filter = 'ALL' | 'UNPAID' | 'PAID' | 'OVERDUE';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNPAID', label: 'Unpaid' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE', label: 'Overdue' },
];
const PAGE = 20;

export function InvoicesPageContent() {
  const m = useMotionSafe();
  const money = usePortalMoney();
  const [limit, setLimit] = React.useState(PAGE);
  const [filter, setFilter] = React.useState<Filter>('ALL');
  // The list endpoint takes only page/limit (no status filter), so the chips filter the loaded items client-side.
  const invoices = useMemberInvoices(1, limit);
  const overview = useMemberOverview();
  const items = React.useMemo(() => invoices.data?.items ?? [], [invoices.data]);
  const billing = overview.data?.billing;

  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { ALL: items.length, UNPAID: 0, PAID: 0, OVERDUE: 0 };
    for (const i of items) {
      if (i.status === 'PAID') c.PAID++;
      else if (i.status === 'OVERDUE') c.OVERDUE++;
      else if (isOpenInvoice(i.status)) c.UNPAID++;
    }
    return c;
  }, [items]);

  const shown = items.filter((i) => (filter === 'ALL' ? true : filter === 'PAID' ? i.status === 'PAID' : filter === 'OVERDUE' ? i.status === 'OVERDUE' : i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID'));

  const outstanding = billing ? parseMoney(billing.outstanding.value) : items.filter((i) => isOpenInvoice(i.status)).reduce((s, i) => s + parseMoney(i.totalAmount), 0);
  const openCount = billing ? billing.outstanding.invoiceCount : items.filter((i) => isOpenInvoice(i.status)).length;

  if (invoices.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Billing"
        title="My invoices"
        subtitle={outstanding > 0 ? `${plural(openCount, 'invoice')} waiting for payment` : 'You are all paid up'}
        chips={outstanding > 0 ? <HeroChip><CalendarClock className="size-3" /> {billing?.nextDueDate ? `Next due ${formatDate(billing.nextDueDate)}` : 'Payment due'}</HeroChip> : <HeroChip><CheckCircle2 className="size-3" /> Nothing due</HeroChip>}
        stats={[
          { label: 'Outstanding', value: outstanding, format: money.format },
          { label: 'Next due', value: billing?.nextDueDate ? formatDate(billing.nextDueDate, { day: 'numeric', month: 'short' }) : '', hidden: !billing?.nextDueDate },
          { label: 'Paid · 90 days', value: billing ? parseMoney(billing.paidLast90Days.value) : 0, format: money.format, hidden: !billing },
        ]}
        actions={<Link href={MEMBER_PORTAL_ROUTES.payments} className={heroActionClass('ghost')}><Wallet className="size-4" /> Payment history</Link>}
      />

      <div role="tablist" aria-label="Filter invoices" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={cn('relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors', active ? 'border-transparent text-primary-foreground' : 'bg-card hover:bg-accent')}
            >
              {active ? <motion.span layoutId="invoice-filter" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} /> : null}
              <span className="relative">{f.label}</span>
              <span className={cn('relative rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-white/25' : 'bg-muted text-muted-foreground')}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyBlock icon={Receipt} title={items.length === 0 ? 'No invoices yet' : 'No invoices match'} description={items.length === 0 ? "Your invoices will show up here once you're billed." : 'Try a different filter.'} />
        </div>
      ) : (
        <motion.div key={filter} variants={m.staggerContainer(0.05)} initial={m.initial} animate="show" className="space-y-3">
          {shown.map((inv) => {
            const st = INVOICE_STATUS[inv.status] ?? { tone: 'muted' as const, label: inv.status };
            const due = dueChip(inv.status, inv.dueDate);
            const open = isOpenInvoice(inv.status);
            return (
              <motion.article key={inv.id} variants={m.fadeUp} className="overflow-hidden rounded-2xl border bg-card shadow-xs" style={due?.tone === 'danger' ? { borderColor: toneTint('danger', 40) } : undefined}>
                <Link href={MEMBER_PORTAL_ROUTES.invoice(inv.id)} className="block space-y-2 p-4 transition-colors active:bg-accent hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: toneTint(st.tone, 15), color: toneColor(st.tone) }}><Receipt className="size-[18px]" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{inv.invoiceNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">Issued {formatDate(inv.invoiceDate)}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-lg font-semibold tabular-nums">{money.format(inv.totalAmount)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip tone={st.tone}>{st.label}</StatusChip>
                    {due ? <StatusChip tone={due.tone}>{due.label}</StatusChip> : null}
                    <span className="text-xs text-muted-foreground">{inv.status === 'PAID' ? '' : `Due ${formatDate(inv.dueDate)}`}</span>
                  </div>
                </Link>
                <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
                  <button
                    type="button"
                    aria-label={`Download ${inv.invoiceNumber}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => memberPortalService.downloadInvoice(inv.id, inv.invoiceNumber).catch(() => toast.error('Could not download this invoice.'))}
                  >
                    <Download className="size-4" /> PDF
                  </button>
                  {open ? <PayInvoiceButton invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} /> : null}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      )}

      {invoices.data && invoices.data.total > items.length ? (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} disabled={invoices.isFetching} className="min-h-11 w-full rounded-xl border bg-card text-sm font-semibold hover:bg-accent disabled:opacity-60">
          {invoices.isFetching ? 'Loading…' : `Load more (${invoices.data.total - items.length} left)`}
        </button>
      ) : null}
    </div>
  );
}

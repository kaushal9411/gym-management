'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, CalendarClock, Download, FileText, ListChecks, Receipt, Wallet } from 'lucide-react';

import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { useMemberInvoice } from '../../hooks/use-member-portal';
import { formatDate, parseMoney, usePortalMoney } from '../../lib/format';
import { memberPortalService } from '../../services/member-portal.service';
import { AnimatedNumber, EmptyBlock, HeroAction, HeroChip, ListRow, PortalHero, PortalList, ProgressRing, SectionCard, SkeletonCard, SkeletonHero, StatusChip, heroActionClass } from '../kit';

import { PayInvoiceButton } from '../pay-invoice-button';
import { INVOICE_STATUS, PAYMENT_STATUS, dueChip, isOpenInvoice } from './invoice-utils';

export function InvoiceDetailContent({ id }: { id: string }) {
  const money = usePortalMoney();
  const q = useMemberInvoice(id);
  const [downloading, setDownloading] = React.useState(false);

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="space-y-4">
        <Link href={MEMBER_PORTAL_ROUTES.invoices} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"><ArrowLeft className="size-4" /> All invoices</Link>
        <div className="rounded-2xl border bg-card"><EmptyBlock icon={Receipt} title="Invoice not found" description="This invoice doesn't exist or isn't yours." /></div>
      </div>
    );
  }

  const inv = q.data;
  const st = INVOICE_STATUS[inv.status] ?? { tone: 'muted' as const, label: inv.status };
  const due = dueChip(inv.status, inv.dueDate);
  const open = isOpenInvoice(inv.status);
  const total = parseMoney(inv.totalAmount);
  const paid = parseMoney(inv.paid);
  const balance = parseMoney(inv.balance);
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : inv.status === 'PAID' ? 100 : 0;
  const tax = parseMoney(inv.taxAmount);
  const discount = parseMoney(inv.discountAmount);

  const download = async () => {
    setDownloading(true);
    try {
      await memberPortalService.downloadInvoice(id, inv.invoiceNumber);
    } catch {
      toast.error('Could not download this invoice.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow={<Link href={MEMBER_PORTAL_ROUTES.invoices} className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="size-3" /> Invoices</Link>}
        title={inv.invoiceNumber}
        subtitle={`Issued ${formatDate(inv.invoiceDate)}${inv.branch ? ` · ${inv.branch.name}` : ''}`}
        chips={
          <>
            <HeroChip>{st.label}</HeroChip>
            {due ? <HeroChip><CalendarClock className="size-3" /> {due.label}</HeroChip> : null}
            {!open ? null : <HeroChip>Due {formatDate(inv.dueDate)}</HeroChip>}
          </>
        }
        aside={
          <ProgressRing value={pct} size={84} thickness={8} onDark>
            <p className="text-base font-bold tabular-nums">{Math.round(pct)}%</p>
            <p className="text-[10px] uppercase tracking-wide text-white/80">paid</p>
          </ProgressRing>
        }
        stats={[
          { label: 'Total', value: total, format: money.format },
          { label: 'Paid', value: paid, format: money.format },
          { label: 'Balance', value: balance, format: money.format },
        ]}
        actions={
          <>
            {open ? <span className="[&_button]:min-h-11 [&_button]:rounded-xl [&_button]:bg-white [&_button]:px-5 [&_button]:text-[color:var(--primary)] [&_button]:hover:bg-white/90"><PayInvoiceButton invoiceId={id} invoiceNumber={inv.invoiceNumber} size="default" /></span> : null}
            <HeroAction onClick={download} disabled={downloading}><Download className="size-4" /> {downloading ? 'Preparing…' : 'Download PDF'}</HeroAction>
            <Link href={MEMBER_PORTAL_ROUTES.payments} className={heroActionClass('ghost')}><Wallet className="size-4" /> Payments</Link>
          </>
        }
      />

      <SectionCard title="Items" subtitle={`${inv.items.length} line ${inv.items.length === 1 ? 'item' : 'items'}`} icon={ListChecks} tone="info" flush>
        {inv.items.length === 0 ? (
          <EmptyBlock compact icon={FileText} title="No line items" />
        ) : (
          <PortalList>
            {inv.items.map((it, i) => (
              <ListRow key={i} icon={FileText} tone="info" title={it.description} subtitle={`${it.quantity} × ${money.format(it.unitPrice)}`} trailing={<span className="font-semibold tabular-nums">{money.format(it.amount)}</span>} />
            ))}
          </PortalList>
        )}
        <dl className="space-y-1.5 border-t bg-muted/30 px-4 py-3 text-sm">
          <Line label="Subtotal" value={money.format(inv.subtotal)} />
          {discount > 0 ? <Line label="Discount" value={`− ${money.format(discount)}`} accent="success" /> : null}
          {tax > 0 ? <Line label="Tax" value={money.format(tax)} /> : null}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums"><AnimatedNumber value={total} format={money.format} /></dd></div>
          <Line label="Paid" value={money.format(paid)} accent="success" />
          <Line label="Balance due" value={money.format(balance)} accent={balance > 0 ? 'danger' : undefined} bold />
        </dl>
      </SectionCard>

      <SectionCard title="Payments" subtitle={inv.payments.length ? `${inv.payments.length} on this invoice` : 'None yet'} icon={Wallet} tone="success" flush>
        {inv.payments.length === 0 ? (
          <EmptyBlock compact icon={Wallet} title="No payments yet" description={open ? 'Pay now to settle this invoice.' : undefined} />
        ) : (
          <PortalList>
            {inv.payments.map((p) => {
              const ps = PAYMENT_STATUS[p.status] ?? { tone: 'muted' as const, label: p.status };
              return (
                <ListRow key={p.paymentNumber} icon={Wallet} tone={ps.tone} title={p.paymentNumber} subtitle={formatDate(p.paymentDate)} trailing={<div className="space-y-0.5"><p className="font-semibold tabular-nums">{money.format(p.finalAmount)}</p><StatusChip tone={ps.tone}>{ps.label}</StatusChip></div>} />
              );
            })}
          </PortalList>
        )}
      </SectionCard>
    </div>
  );
}

function Line({ label, value, accent, bold }: { label: string; value: string; accent?: 'success' | 'danger'; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${bold ? 'font-semibold' : ''}`} style={accent ? { color: `var(--${accent === 'danger' ? 'destructive' : 'success'})` } : undefined}>{value}</dd>
    </div>
  );
}

'use client';

/**
 * /payments/invoices/[invoiceId]. Data: GET /admin/payments/invoices/:id. Actions reuse the tenant-scoped PDF download and
 * email-invoice endpoints. The coupon chip links to /coupons (no per-coupon detail route exists).
 */
import * as React from 'react';
import Link from 'next/link';
import { FileDown, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toBillingError } from '@/features/billing/hooks/use-billing';
import { Chip, Panel } from '@/features/dashboard/components/ui';
import { TableScroll, fmtDate, money, statusLabel, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useEmailInvoiceAny, useInvoiceDetail, useInvoicePdfAny, type InvoiceDetail } from '../api/insights';
import { BackLink, Banner, ConfirmRow, LINK, NotFoundCard, ProviderChip, StatusChip, daysOverdue } from './pay-kit';
import { useNow } from '@/features/dashboard/components/use-now';

function Actions({ inv }: { inv: InvoiceDetail['invoice'] }) {
  const canManage = useHasPermission('payments:manage');
  const pdf = useInvoicePdfAny();
  const email = useEmailInvoiceAny();
  const [ask, setAsk] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  return (
    <Panel title="Actions" index={4}>
      <div className="space-y-3 text-[13px]">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={pdf.isPending} onClick={() => pdf.mutate({ tenantId: inv.tenant.id, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber }, { onError: (e) => toast.error(toBillingError(e).message) })}>
            {pdf.isPending ? <Loader2 className="animate-spin" /> : <FileDown />}Download PDF
          </Button>
          {canManage && !ask ? <Button size="sm" onClick={() => { setSent(false); setAsk(true); }}><Mail />Email to tenant owner</Button> : null}
        </div>
        {!canManage ? <p className="text-xs text-muted-foreground">Emailing invoices needs the payments:manage permission.</p> : null}
        {ask ? (
          <ConfirmRow text={`Email ${inv.invoiceNumber} to the owner of ${inv.tenant.name}?`} confirmLabel="Send email" busy={email.isPending} onCancel={() => setAsk(false)}
            onConfirm={() => email.mutate({ tenantId: inv.tenant.id, invoiceId: inv.id }, { onSuccess: () => { setAsk(false); setSent(true); toast.success('Invoice emailed.'); }, onError: (e) => { setAsk(false); toast.error(toBillingError(e).message); } })} />
        ) : null}
        {sent ? <p role="status"><Chip tone="green">Invoice emailed to the owner</Chip></p> : null}
      </div>
    </Panel>
  );
}

export function InvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const q = useInvoiceDetail(invoiceId);
  const now = useNow();
  if (q.isPending) {
    return <div className="mx-auto max-w-[1600px] space-y-4" aria-busy="true" aria-label="Loading invoice"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-64 rounded-[14px]" /><Skeleton className="h-40 rounded-[14px]" /></div>;
  }
  if (q.isError || !q.data) return <NotFoundCard what="Invoice" message={q.error?.message} backHref="/payments?tab=invoices" backLabel="Back to invoices" onRetry={() => void q.refetch()} />;
  const { invoice: inv, payments, subscription } = q.data;
  const late = inv.status === 'OPEN' ? daysOverdue(inv.dueDate, now) : 0;
  const row = 'flex items-baseline justify-between gap-3 py-1.5 text-[13px]';
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <BackLink href="/payments?tab=invoices">Invoices</BackLink>
      <Banner>
        <p className="text-xs font-medium uppercase tracking-wide text-teal-100">Invoice</p>
        <h1 className="mt-0.5 flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight"><span className="font-mono">{inv.invoiceNumber}</span><StatusChip status={inv.status} /></h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-teal-50">
          <span className="text-xl font-semibold tabular-nums text-white">{money(inv.total, inv.currency)}</span>
          <Link href={`/tenants/${inv.tenant.id}`} className="font-semibold underline-offset-2 hover:underline">{inv.tenant.name}</Link>
          <span>Due {fmtDate(inv.dueDate)}</span>
          {late > 0 ? <Chip tone="red">Overdue {late} day{late === 1 ? '' : 's'}</Chip> : null}
        </div>
      </Banner>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Panel title="Line items" hint={`${inv.items.length}`} className="md:col-span-2 xl:col-span-8" index={0}>
          {inv.items.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">This invoice has no line items.</p> : (
            <TableScroll label="Invoice line items">
              <table className="w-full min-w-[480px] border-collapse">
                <thead><tr><th scope="col" className={thClass}>Description</th><th scope="col" className={`${thClass} text-right`}>Qty</th><th scope="col" className={`${thClass} text-right`}>Unit</th><th scope="col" className={`${thClass} text-right`}>Amount</th></tr></thead>
                <tbody>{inv.items.map((i) => (
                  <tr key={i.id}><td className={tdClass}>{i.description}</td><td className={`${tdClass} text-right tabular-nums`}>{i.quantity}</td><td className={`${tdClass} text-right tabular-nums`}>{money(i.unitPrice, inv.currency)}</td><td className={`${tdClass} text-right font-semibold tabular-nums`}>{money(i.amount, inv.currency)}</td></tr>
                ))}</tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
        <Panel title="Totals" className="xl:col-span-4" index={1}>
          <dl className="divide-y">
            <div className={row}><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(inv.subtotal, inv.currency)}</dd></div>
            <div className={row}><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{money(inv.taxAmount, inv.currency)}</dd></div>
            <div className={row}><dt className="flex items-center gap-1.5 text-muted-foreground">Discount{inv.coupon ? <Link href="/coupons" aria-label={`Coupon ${inv.coupon.code}`}><Chip tone="violet">{inv.coupon.code}</Chip></Link> : null}</dt><dd className="tabular-nums">{Number(inv.discountAmount) > 0 ? `-${money(inv.discountAmount, inv.currency)}` : money(0, inv.currency)}</dd></div>
            <div className={`${row} text-base font-semibold`}><dt>Total</dt><dd className="tabular-nums">{money(inv.total, inv.currency)}</dd></div>
          </dl>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
            <div><dt className="text-xs text-muted-foreground">Issued</dt><dd>{fmtDate(inv.createdAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Paid</dt><dd>{fmtDate(inv.paidAt)}</dd></div>
          </dl>
        </Panel>

        <Panel title="Linked payments" hint={`${payments.length}`} className="md:col-span-2 xl:col-span-8" index={2}>
          {payments.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No payment has been recorded against this invoice.</p> : (
            <TableScroll label="Linked payments">
              <table className="w-full min-w-[520px] border-collapse">
                <thead><tr><th scope="col" className={thClass}>Provider</th><th scope="col" className={thClass}>Status</th><th scope="col" className={`${thClass} text-right`}>Amount</th><th scope="col" className={thClass}>Paid at</th><th scope="col" className={thClass}>Payment</th></tr></thead>
                <tbody>{payments.map((p) => (
                  <tr key={p.id}><td className={tdClass}><ProviderChip provider={p.provider} /></td><td className={tdClass}><StatusChip status={p.status} /></td><td className={`${tdClass} text-right font-semibold tabular-nums`}>{money(p.amount, p.currency)}</td><td className={`${tdClass} whitespace-nowrap`}>{fmtDate(p.paidAt)}</td><td className={tdClass}><Link href={`/payments/${p.id}`} className={LINK}>View</Link></td></tr>
                ))}</tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
        <div className="space-y-4 xl:col-span-4">
          <Panel title="Subscription" index={3}>
            {subscription ? (
              <div className="space-y-2 text-[13px]">
                <p className="flex items-center gap-2"><Chip tone="blue">{subscription.plan}</Chip><Chip tone={subscription.status === 'ACTIVE' ? 'green' : 'slate'}>{statusLabel(subscription.status)}</Chip></p>
                <Link href={`/tenants/${inv.tenant.id}?tab=subscription`} className={LINK}>Open {inv.tenant.name} subscription</Link>
              </div>
            ) : <p className="text-sm text-muted-foreground">Not linked to a subscription.</p>}
          </Panel>
          <Actions inv={inv} />
        </div>
      </div>
    </div>
  );
}

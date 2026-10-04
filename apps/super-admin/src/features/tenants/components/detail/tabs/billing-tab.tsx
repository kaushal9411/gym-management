'use client';

/**
 * Billing tab. Data: GET …/payments and GET …/invoices (newest 100 each; KPIs, charts, paging and CSV are computed client-side
 * over the loaded rows). Ported from the old page: invoice PDF + email-invoice, PENDING payment verify-status + resend link,
 * send payment link for the open invoice (with copy). Dropped: "tax/discount" columns (always 0 in dev data, not part of the approved table).
 * Email-invoice and send-link confirmations are inline rows (no dialogs).
 */
import * as React from 'react';
import { Copy, Download, FileDown, Mail } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { downloadCsv } from '@/features/dashboard/components/export-csv';
import { fmtMoneyCompact } from '@/features/dashboard/components/format';
import { ChartTooltip, Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { toBillingError, useCreatePaymentLink, useDownloadInvoicePdf, useEmailInvoice, useResendNotification, useVerifyPaymentStatus } from '@/features/billing/hooks/use-billing';
import type { PaymentLinkResult } from '@/features/billing/types';
import { BILLING_FETCH_LIMIT, useTenantBillingInvoices, useTenantBillingPayments, type TabInvoice, type TabPayment } from '../../../api/tabs';
import { CountChips, ErrorNote, MixBar, PagerBar, Stat, StatRow, TabSkeleton, TableScroll, fmtDate, fmtDateTime, money, statusLabel, statusTone, tdClass, thClass, type TabProps } from './_shared/kit';

const PAGE = 10;
const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const STATUS_COLOR: Record<string, string> = { SUCCEEDED: 'var(--chart-6)', PENDING: 'var(--chart-4)', FAILED: 'var(--chart-5)' };
const csvEsc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvEsc).join(',')).join('\n');

const payDate = (p: TabPayment) => p.paidAt ?? p.createdAt;
const method = (p: TabPayment) => (p.paymentMode ? statusLabel(p.paymentMode) : statusLabel(p.provider));

function MonthChart({ payments }: { payments: TabPayment[] }) {
  const reduce = !!useReducedMotion();
  const data = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) if (p.status === 'SUCCEEDED') { const k = payDate(p).slice(0, 7); m.set(k, (m.get(k) ?? 0) + Number(p.amount)); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => ({ label: new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), amount: v }));
  }, [payments]);
  if (data.length === 0) return <EmptyNote>No successful payments to chart yet.</EmptyNote>;
  return (
    <div className="h-[180px] w-full" role="img" aria-label="Successful payments by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => fmtMoneyCompact(v)} />
          <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={(v) => money(v)} names={{ amount: 'Paid' }} />} />
          <RBar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={!reduce} animationDuration={250} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaymentLinkCard({ tenantId, invoice }: { tenantId: string; invoice: TabInvoice | undefined }) {
  const create = useCreatePaymentLink(tenantId);
  const verify = useVerifyPaymentStatus(tenantId);
  const resend = useResendNotification(tenantId);
  const [confirm, setConfirm] = React.useState(false);
  const [link, setLink] = React.useState<PaymentLinkResult | null>(null);
  return (
    <Panel title="Collect payment" index={1} hint={invoice ? `Invoice ${invoice.invoiceNumber}` : undefined}>
      <div className="space-y-3 text-[13px]">
        {invoice ? (
          <p className="flex justify-between font-medium"><span>Outstanding</span><span className="tabular-nums">{money(invoice.total, invoice.currency)}</span></p>
        ) : <p className="text-muted-foreground">No outstanding invoice on file — sending a link generates one automatically for the current plan.</p>}
        {link ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <Input readOnly aria-label="Payment link" value={link.shortUrl} className="h-8 text-xs" />
              <Button size="icon" variant="outline" className="size-8" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(link.shortUrl); toast.success('Copied to clipboard.'); }}><Copy /></Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Chip tone={statusTone(link.status)}>{statusLabel(link.status)}</Chip>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={resend.isPending || link.status !== 'PENDING'} onClick={() => resend.mutate({ paymentId: link.paymentId, medium: 'email' }, { onSuccess: () => toast.success('Notification resent.'), onError: (e) => toast.error(toBillingError(e).message) })}>Resend by email</Button>
                <Button size="sm" disabled={verify.isPending || link.status !== 'PENDING'} onClick={() => verify.mutate(link.paymentId, {
                  onSuccess: (r) => { setLink((p) => (p ? { ...p, status: r.status } : p)); if (r.status === 'SUCCEEDED') toast.success('Payment confirmed — subscription reactivated.'); if (r.status === 'FAILED') toast.error('Payment link expired or was cancelled.'); },
                  onError: (e) => toast.error(toBillingError(e).message),
                })}>Check status</Button>
              </div>
            </div>
          </div>
        ) : confirm ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <span className="min-w-0 flex-1">Create a payment link{invoice ? ` for ${invoice.invoiceNumber}` : ' and a new invoice'}?</span>
            <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button size="sm" disabled={create.isPending} onClick={() => create.mutate(invoice?.id, { onSuccess: (r) => { setLink({ paymentId: r.paymentId, invoiceId: r.invoiceId, shortUrl: r.shortUrl, status: r.status }); setConfirm(false); toast.success('Payment link created.'); }, onError: (e) => toast.error(toBillingError(e).message) })}>{create.isPending ? 'Creating…' : 'Create link'}</Button>
          </div>
        ) : <Button size="sm" onClick={() => setConfirm(true)}>Send payment link…</Button>}
      </div>
    </Panel>
  );
}

function InvoicesTable({ tenantId, rows, canBilling, tenantSlug }: { tenantId: string; rows: TabInvoice[]; canBilling: boolean; tenantSlug: string }) {
  const [page, setPage] = React.useState(1);
  const [emailing, setEmailing] = React.useState<string | null>(null);
  const pdf = useDownloadInvoicePdf(tenantId);
  const email = useEmailInvoice(tenantId);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const view = rows.slice((cur - 1) * PAGE, cur * PAGE);
  const exportCsv = () => downloadCsv(`${tenantSlug}-invoices-p${cur}.csv`, toCsv([['Invoice', 'Issued', 'Paid', 'Amount', 'Currency', 'Status'], ...view.map((i) => [i.invoiceNumber, i.createdAt, i.paidAt ?? '', i.total, i.currency, i.status])]));
  return (
    <Panel title="Invoices" index={3} hint={`${rows.length}`} right={rows.length ? <Button size="sm" variant="outline" onClick={exportCsv}><Download />CSV</Button> : null}>
      {rows.length === 0 ? <EmptyNote>No invoices yet.</EmptyNote> : (
        <>
          <TableScroll label="Invoices">
            <table className="w-full min-w-[640px] border-collapse">
              <thead><tr><th className={thClass}>Invoice #</th><th className={thClass}>Issued</th><th className={thClass}>Paid</th><th className={`${thClass} text-right`}>Amount</th><th className={thClass}>Status</th><th className={`${thClass} text-right`}>Actions</th></tr></thead>
              <tbody>
                {view.map((i) => (
                  <tr key={i.id}>
                    <td className={`${tdClass} font-mono text-xs`}>{i.invoiceNumber}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{fmtDate(i.createdAt)}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{fmtDate(i.paidAt)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{money(i.total, i.currency)}</td>
                    <td className={tdClass}><Chip tone={statusTone(i.status)}>{statusLabel(i.status)}</Chip></td>
                    <td className={`${tdClass} text-right`}>
                      {emailing === i.id ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">Email to owner?
                          <Button size="sm" variant="outline" onClick={() => setEmailing(null)}>No</Button>
                          <Button size="sm" disabled={email.isPending} onClick={() => email.mutate({ invoiceId: i.id }, { onSuccess: () => { toast.success('Invoice emailed.'); setEmailing(null); }, onError: (e) => toast.error(toBillingError(e).message) })}>{email.isPending ? 'Sending…' : 'Send'}</Button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-1.5">
                          <Button size="sm" variant="outline" disabled={pdf.isPending} aria-label={`Download PDF for ${i.invoiceNumber}`} onClick={() => pdf.mutate({ invoiceId: i.id, invoiceNumber: i.invoiceNumber }, { onError: (e) => toast.error(toBillingError(e).message) })}><FileDown />PDF</Button>
                          {canBilling ? <Button size="sm" variant="outline" aria-label={`Email ${i.invoiceNumber}`} onClick={() => setEmailing(i.id)}><Mail />Email</Button> : null}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <PagerBar page={cur} totalPages={pages} total={rows.length} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}

function PaymentsTable({ tenantId, rows, canBilling, tenantSlug }: { tenantId: string; rows: TabPayment[]; canBilling: boolean; tenantSlug: string }) {
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState<'ALL' | 'SUCCEEDED' | 'PENDING' | 'FAILED'>('ALL');
  const verify = useVerifyPaymentStatus(tenantId);
  const resend = useResendNotification(tenantId);
  const counts = { SUCCEEDED: 0, PENDING: 0, FAILED: 0 } as Record<string, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const filtered = filter === 'ALL' ? rows : rows.filter((r) => r.status === filter);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const view = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const exportCsv = () => downloadCsv(`${tenantSlug}-payments-${filter.toLowerCase()}-p${cur}.csv`, toCsv([['Date', 'Amount', 'Currency', 'Method', 'Status', 'Gateway id', 'Failure reason'], ...view.map((p) => [payDate(p), p.amount, p.currency, method(p), p.status, p.gatewayReference ?? '', p.failureReason ?? ''])]));
  return (
    <Panel title="Payments" index={4} hint={`${rows.length}`} right={rows.length ? <Button size="sm" variant="outline" onClick={exportCsv}><Download />CSV</Button> : null}>
      {rows.length === 0 ? <EmptyNote>No payments yet.</EmptyNote> : (
        <>
          <div className="mb-3"><CountChips label="Payment status" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: 'ALL', label: 'All', count: rows.length }, { value: 'SUCCEEDED', label: 'Succeeded', count: counts.SUCCEEDED }, { value: 'PENDING', label: 'Pending', count: counts.PENDING }, { value: 'FAILED', label: 'Failed', count: counts.FAILED }]} /></div>
          <TableScroll label="Payments">
            <table className="w-full min-w-[680px] border-collapse">
              <thead><tr><th className={thClass}>Date</th><th className={`${thClass} text-right`}>Amount</th><th className={thClass}>Method</th><th className={thClass}>Status</th><th className={thClass}>Gateway id</th><th className={`${thClass} text-right`}>Actions</th></tr></thead>
              <tbody>
                {view.length === 0 ? <tr><td colSpan={6} className={`${tdClass} text-center text-muted-foreground`}>No {filter.toLowerCase()} payments.</td></tr> : view.map((p) => (
                  <tr key={p.id}>
                    <td className={`${tdClass} whitespace-nowrap`}>{fmtDateTime(payDate(p))}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{money(p.amount, p.currency)}</td>
                    <td className={tdClass}>{method(p)}</td>
                    <td className={tdClass}><Chip tone={statusTone(p.status)}>{statusLabel(p.status)}</Chip></td>
                    <td className={`${tdClass} max-w-[200px] truncate font-mono text-xs`} title={p.gatewayReference ?? p.failureReason ?? undefined}>{p.gatewayReference ?? (p.failureReason ? <span className="font-sans text-red-700 dark:text-red-400">{p.failureReason}</span> : '—')}</td>
                    <td className={`${tdClass} text-right`}>
                      {p.status === 'PENDING' && canBilling ? (
                        <span className="inline-flex gap-1.5">
                          <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => resend.mutate({ paymentId: p.id, medium: 'email' }, { onSuccess: () => toast.success('Notification resent.'), onError: (e) => toast.error(toBillingError(e).message) })}>Resend link</Button>
                          <Button size="sm" disabled={verify.isPending} onClick={() => verify.mutate(p.id, { onSuccess: (r) => toast.message(`Payment status: ${statusLabel(r.status)}`), onError: (e) => toast.error(toBillingError(e).message) })}>Verify status</Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <PagerBar page={cur} totalPages={pages} total={filtered.length} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}

export function BillingTab({ tenantId, tenantSlug, canManage }: TabProps) {
  const pay = useTenantBillingPayments(tenantId);
  const inv = useTenantBillingInvoices(tenantId);
  const canBilling = useHasPermission('payments:manage') && canManage;
  if (pay.isLoading || inv.isLoading) return <TabSkeleton rows={6} />;
  if (pay.isError || inv.isError) return <ErrorNote what="billing data" message={(pay.error ?? inv.error)?.message} onRetry={() => { void pay.refetch(); void inv.refetch(); }} />;
  const payments = pay.data?.items ?? [];
  const invoices = inv.data?.items ?? [];
  const succeeded = payments.filter((p) => p.status === 'SUCCEEDED');
  const failed = payments.filter((p) => p.status === 'FAILED');
  const open = invoices.filter((i) => i.status === 'OPEN');
  const currency = payments[0]?.currency ?? invoices[0]?.currency ?? 'INR';
  const paid = succeeded.reduce((a, p) => a + Number(p.amount), 0);
  const outstanding = open.reduce((a, i) => a + Number(i.total), 0);
  const last = [...succeeded].sort((a, b) => payDate(b).localeCompare(payDate(a)))[0];
  const truncated = (pay.data?.total ?? 0) > BILLING_FETCH_LIMIT || (inv.data?.total ?? 0) > BILLING_FETCH_LIMIT;
  const mix = (['SUCCEEDED', 'PENDING', 'FAILED'] as const).map((s) => ({ label: statusLabel(s), value: payments.filter((p) => p.status === s).length, color: STATUS_COLOR[s]! }));
  return (
    <div className="space-y-4">
      <StatRow>
        <Stat index={0} label="Lifetime paid" value={money(paid, currency)} caption={`${succeeded.length} successful payment${succeeded.length === 1 ? '' : 's'}`} />
        <Stat index={1} label="Outstanding" value={money(outstanding, currency)} caption={`${open.length} open invoice${open.length === 1 ? '' : 's'}`} tone={outstanding > 0 ? 'bad' : undefined} />
        <Stat index={2} label="Last payment" value={last ? fmtDate(payDate(last)) : '—'} caption={last ? money(last.amount, last.currency) : 'No payment yet'} />
        <Stat index={3} label="Failed payments" value={String(failed.length)} caption={failed.length ? 'Needs follow-up' : 'None'} tone={failed.length ? 'bad' : undefined} />
      </StatRow>
      {truncated ? <p className="text-xs text-muted-foreground">Showing the newest {BILLING_FETCH_LIMIT} rows; figures above cover those rows only.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Payments by month" hint="Successful only" index={0}>
          <MonthChart payments={payments} />
          <div className="mt-3"><MixBar label="Payment status mix" items={mix} /></div>
        </Panel>
        {canBilling ? <PaymentLinkCard tenantId={tenantId} invoice={open[0]} /> : <Panel title="Collect payment" index={1}><p className="text-sm text-muted-foreground">You need the payments:manage permission to send payment links or email invoices.</p></Panel>}
      </div>
      <InvoicesTable tenantId={tenantId} rows={invoices} canBilling={canBilling} tenantSlug={tenantSlug} />
      <PaymentsTable tenantId={tenantId} rows={payments} canBilling={canBilling} tenantSlug={tenantSlug} />
    </div>
  );
}

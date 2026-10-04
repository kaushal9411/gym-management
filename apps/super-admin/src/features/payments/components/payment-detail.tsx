'use client';

/**
 * /payments/[paymentId]. Data: GET /admin/payments/:id (timeline + webhook log; payloads are masked server-side).
 * Actions reuse the tenant-scoped verify / resend endpoints (tenant id from the payment). Not on the API, so shown as a muted
 * note rather than faked: refunds, retry-charge, mark-as-paid. Attempts count is not derivable (one row per attempt) and is dropped.
 */
import * as React from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useReducedMotion, motion } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toBillingError } from '@/features/billing/hooks/use-billing';
import { Avatar, Chip, Panel } from '@/features/dashboard/components/ui';
import { TableScroll, fmtDateTime, money, statusLabel, tdClass, thClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { usePaymentDetail, useResendAny, useVerifyAnyPayment, type PaymentDetail, type WebhookTx } from '../api/insights';
import { BackLink, Banner, ConfirmRow, CopyButton, LINK, ModeChip, NotFoundCard, ProviderChip, StatusChip } from './pay-kit';

const EVENT_COLOR = (e: string): string => (/fail/i.test(e) ? 'var(--chart-5)' : /paid|captured|success|succeeded/i.test(e) ? 'var(--chart-6)' : /refund/i.test(e) ? 'var(--chart-3)' : e === 'created' ? 'var(--chart-1)' : 'var(--chart-4)');

function Tile({ label, children, index }: { label: string; children: React.ReactNode; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: reduce ? 0 : index * 0.03 }} className="min-w-0 rounded-[14px] border bg-card px-4 py-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 text-lg font-semibold leading-tight tracking-tight">{children}</div>
    </motion.div>
  );
}

function Timeline({ events }: { events: PaymentDetail['timeline'] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No events recorded.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <i className="absolute -left-[27px] top-1 size-3 rounded-full ring-4 ring-card" style={{ background: EVENT_COLOR(e.event) }} aria-hidden />
          <p className="text-[13px] font-semibold">{statusLabel(e.event.replace(/\./g, ' '))}</p>
          <p className="text-xs text-muted-foreground">{e.detail}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{fmtDateTime(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}

function WebhookRow({ t }: { t: WebhookTx }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <tr>
        <td className={`${tdClass} font-mono text-xs`}>{t.eventType}</td>
        <td className={tdClass}><ProviderChip provider={t.provider} /></td>
        <td className={tdClass}><Chip tone={t.signatureValid ? 'green' : 'red'}>{t.signatureValid ? 'Valid' : 'Invalid'}</Chip></td>
        <td className={`${tdClass} whitespace-nowrap`}>{t.processedAt ? fmtDateTime(t.processedAt) : <span className="text-muted-foreground">Not processed</span>}</td>
        <td className={`${tdClass} text-right`}>
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${LINK} inline-flex items-center gap-1 text-xs`}>
            {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}Payload
          </button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} className="border-b border-border/60 bg-muted/30 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-3.5" aria-hidden />Read-only. Sensitive fields (email, phone, UPI, card, bank, secrets) are masked by the server and show [masked].</p>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-focusable */}
            <pre tabIndex={0} aria-label={`Masked payload for ${t.eventType}`} className="max-h-72 overflow-auto rounded-lg border bg-card p-3 font-mono text-xs leading-relaxed">{JSON.stringify(t.rawPayload, null, 2)}</pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

type Verdict = { tone: 'green' | 'red' | 'amber'; text: string };

function ActionsCard({ p }: { p: PaymentDetail }) {
  const canManage = useHasPermission('payments:manage');
  const verify = useVerifyAnyPayment();
  const resend = useResendAny();
  const [ask, setAsk] = React.useState<'verify' | 'resend' | null>(null);
  const [res, setRes] = React.useState<Verdict | null>(null);
  const pending = p.status === 'PENDING';
  const run = (kind: 'verify' | 'resend') => {
    const args = { tenantId: p.tenant.id, paymentId: p.id };
    if (kind === 'verify') {
      verify.mutate(args, {
        onSuccess: (r) => { setRes({ tone: r.status === 'SUCCEEDED' ? 'green' : r.status === 'FAILED' ? 'red' : 'amber', text: `Gateway says: ${statusLabel(r.status)}` }); setAsk(null); },
        onError: (e) => { setRes({ tone: 'red', text: toBillingError(e).message }); setAsk(null); },
      });
    } else {
      resend.mutate(args, {
        onSuccess: () => { setRes({ tone: 'green', text: 'Notification sent to the tenant owner' }); setAsk(null); toast.success('Notification resent.'); },
        onError: (e) => { setRes({ tone: 'red', text: toBillingError(e).message }); setAsk(null); },
      });
    }
  };
  return (
    <Panel title="Actions" index={3}>
      <div className="space-y-3 text-[13px]">
        {!canManage ? <p className="text-muted-foreground">You need the payments:manage permission to act on payments.</p> : !pending ? <p className="text-muted-foreground">Check status and resend apply to pending payments only.</p> : ask ? (
          <ConfirmRow
            text={ask === 'verify' ? 'Ask the gateway for the current status of this payment? A successful result updates the payment and subscription.' : 'Email the payment link again to the tenant owner?'}
            confirmLabel={ask === 'verify' ? 'Check status' : 'Resend'} busy={verify.isPending || resend.isPending} onCancel={() => setAsk(null)} onConfirm={() => run(ask)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setRes(null); setAsk('verify'); }}>Check status</Button>
            <Button size="sm" variant="outline" onClick={() => { setRes(null); setAsk('resend'); }}>Resend payment notification</Button>
          </div>
        )}
        {res ? <p role="status"><Chip tone={res.tone}>{res.text}</Chip></p> : null}
        <Link href={`/tenants/${p.tenant.id}?tab=billing`} className={`${LINK} inline-flex items-center gap-1.5`}><Building2 className="size-3.5" aria-hidden />Open tenant billing</Link>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Refunds, retries and mark-as-paid are not available in this version.</p>
      </div>
    </Panel>
  );
}

export function PaymentDetailView({ paymentId }: { paymentId: string }) {
  const q = usePaymentDetail(paymentId);
  if (q.isPending) {
    return <div className="mx-auto max-w-[1600px] space-y-4" aria-busy="true" aria-label="Loading payment"><Skeleton className="h-28 rounded-2xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-[14px]" />)}</div><Skeleton className="h-72 rounded-[14px]" /></div>;
  }
  if (q.isError || !q.data) return <NotFoundCard what="Payment" message={q.error?.message} backHref="/payments" backLabel="Back to payments" onRetry={() => void q.refetch()} />;
  const p = q.data;
  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <BackLink href="/payments">Payments</BackLink>
      <Banner>
        <p className="text-xs font-medium uppercase tracking-wide text-teal-100">Payment</p>
        <h1 className="mt-0.5 flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight tabular-nums">{money(p.amount, p.currency)}<StatusChip status={p.status} /></h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-teal-50">
          <ProviderChip provider={p.provider} />{p.paymentMode ? <ModeChip mode={p.paymentMode} /> : null}
          <Link href={`/tenants/${p.tenant.id}`} className="font-semibold underline-offset-2 hover:underline">{p.tenant.name}</Link>
          {p.invoice ? <Link href={`/payments/invoices/${p.invoice.id}`} className="font-mono text-xs underline-offset-2 hover:underline">{p.invoice.invoiceNumber}</Link> : null}
        </div>
      </Banner>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile index={0} label="Amount"><span className="tabular-nums">{money(p.amount, p.currency)}</span></Tile>
        <Tile index={1} label="Paid at"><span className="text-base">{p.paidAt ? fmtDateTime(p.paidAt) : p.status === 'SUCCEEDED' ? 'Not recorded' : '—'}</span></Tile>
        <Tile index={2} label="Gateway reference">{p.gatewayReference ? <span className="flex items-center gap-1"><span className="truncate font-mono text-sm" title={p.gatewayReference}>{p.gatewayReference}</span><CopyButton value={p.gatewayReference} label="gateway reference" /></span> : <span className="text-muted-foreground">—</span>}</Tile>
        <Tile index={3} label="Plan">{p.planName ? <Chip tone="blue">{p.planName}</Chip> : <span className="text-muted-foreground">—</span>}</Tile>
      </div>

      {p.status === 'FAILED' ? (
        <div role="alert" className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <p className="font-semibold">Payment failed</p>
          <p className="mt-0.5">{p.failureReason ?? 'The gateway did not record a failure reason.'}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Panel title="Status timeline" className="xl:col-span-7" index={0}><Timeline events={p.timeline} /></Panel>
        <div className="space-y-4 xl:col-span-5">
          <Panel title="Tenant & plan" index={1}>
            <div className="flex items-center gap-3">
              <Avatar name={p.tenant.name} seed={p.tenant.id} />
              <div className="min-w-0"><Link href={`/tenants/${p.tenant.id}`} className={`${LINK} block truncate`}>{p.tenant.name}</Link><p className="truncate text-xs text-muted-foreground">{p.tenant.slug}</p></div>
              {p.planName ? <span className="ml-auto"><Chip tone="blue">{p.planName}</Chip></span> : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <div><dt className="text-xs text-muted-foreground">Created</dt><dd>{fmtDateTime(p.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Last updated</dt><dd>{fmtDateTime(p.updatedAt)}</dd></div>
              {p.invoice ? <div className="col-span-2"><dt className="text-xs text-muted-foreground">Invoice</dt><dd><Link href={`/payments/invoices/${p.invoice.id}`} className={`${LINK} font-mono text-xs`}>{p.invoice.invoiceNumber}</Link></dd></div> : null}
            </dl>
          </Panel>
          <ActionsCard p={p} />
        </div>
      </div>

      <Panel title="Webhook log" hint={`${p.transactions.length}`} index={4}>
        {p.transactions.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No webhook events received for this payment{p.provider === 'MANUAL' ? ' (manual payments never touch a gateway)' : ''}.</p> : (
          <TableScroll label="Webhook events">
            <table className="w-full min-w-[640px] border-collapse">
              <thead><tr><th scope="col" className={thClass}>Event</th><th scope="col" className={thClass}>Provider</th><th scope="col" className={thClass}>Signature</th><th scope="col" className={thClass}>Processed</th><th scope="col" className={`${thClass} text-right`}>Details</th></tr></thead>
              <tbody>{p.transactions.map((t) => <WebhookRow key={t.id} t={t} />)}</tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  );
}

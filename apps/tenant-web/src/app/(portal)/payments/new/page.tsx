'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Link2, Mail, MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { Chip, FieldLabel, PanelCard } from '@/features/finance/components/payments/payments-ui';
import { HeroSteps, MemberSnapshot, OptionCard, RecentPaymentsCard, StepHeader, SummaryCard } from '@/features/finance/components/payments/record-payment-parts';
import {
  toFinanceError,
  useCreatePayment,
  useCreatePaymentLink,
  useInvoice,
  useInvoiceList,
  useResendPaymentLinkNotification,
  useVerifyPaymentStatus,
} from '@/features/finance/hooks/use-finance';
import type { MemberPaymentMethod, PaymentLinkResult } from '@/features/finance/types';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import type { MemberListItem } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';

/** Offline/manual methods only — Online is its own dedicated Payment Link flow, not a value staff pick here. No card-number/expiry/CVV fields exist anywhere on this page. */
const OFFLINE_METHODS: { value: MemberPaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'DEBIT_CARD', label: 'Debit card' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
];

type Channel = 'online' | 'offline';
type LinkStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

function MoneyInput({ id, value, onChange, big }: { id: string; value: string; onChange: (v: string) => void; big?: boolean }) {
  const sym = useCurrencySymbol();
  return (
    <div className="flex h-12 items-center gap-2 rounded-xl border border-input bg-background px-3.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
      <b>{sym}</b>
      <input id={id} type="number" min={0} step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={cn('w-full bg-transparent tabular-nums outline-none', big ? 'text-lg font-extrabold' : 'text-sm')} />
    </div>
  );
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const currencySymbol = useCurrencySymbol();
  const createPayment = useCreatePayment();
  const createPaymentLink = useCreatePaymentLink();
  const verifyPaymentStatus = useVerifyPaymentStatus();
  const resendEmail = useResendPaymentLinkNotification();
  const resendSms = useResendPaymentLinkNotification();

  const [channel, setChannel] = React.useState<Channel>('offline');
  const [member, setMember] = React.useState<MemberListItem | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [discount, setDiscount] = React.useState('');
  const [tax, setTax] = React.useState('');
  const [method, setMethod] = React.useState<MemberPaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [transactionReference, setTransactionReference] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [notifyEmail, setNotifyEmail] = React.useState(false);
  const [notifySms, setNotifySms] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [linkResult, setLinkResult] = React.useState<PaymentLinkResult | null>(null);
  const [linkStatus, setLinkStatus] = React.useState<LinkStatus | null>(null);

  const hasEmail = Boolean(member?.email);
  const hasPhone = Boolean(member?.phone);

  // Notify checkboxes are OFF by default (FRONTEND-GUIDE rule) — a contact-less
  // member can't have them on, so clear them whenever the selection changes.
  React.useEffect(() => {
    setNotifyEmail(false);
    setNotifySms(false);
    setSelectedInvoiceId('');
  }, [member]);

  // Outstanding invoices for the selected member — settling one is optional
  // on either channel (Online or Offline); picking one prefills the amount
  // with what's still due.
  const invoices = useInvoiceList({ page: 1, limit: 20, memberId: member?.id, sortBy: 'createdAt', sortDir: 'desc' });
  const outstandingInvoices = (invoices.data?.items ?? []).filter((i) => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID');
  const selectedInvoice = useInvoice(selectedInvoiceId || null);

  React.useEffect(() => {
    if (!selectedInvoice.data) return;
    const amountPaid = selectedInvoice.data.payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + Number(p.finalAmount), 0);
    const due = Math.max(Number(selectedInvoice.data.totalAmount) - amountPaid, 0);
    setAmount(due.toFixed(2));
  }, [selectedInvoice.data]);

  const finalAmount = Math.max((Number(amount) || 0) - (Number(discount) || 0) + (Number(tax) || 0), 0);

  const amountPaidSoFar = selectedInvoice.data
    ? selectedInvoice.data.payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + Number(p.finalAmount), 0)
    : 0;
  const totalDue = selectedInvoice.data ? Math.max(Number(selectedInvoice.data.totalAmount) - amountPaidSoFar, 0) : null;

  const validate = (): boolean => {
    setError(null);
    if (!member) {
      setError('Select a member first.');
      return false;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount.');
      return false;
    }
    return true;
  };

  const submitOffline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !member) return;
    createPayment.mutate(
      {
        memberId: member.id,
        membershipId: member.currentMembership?.id,
        invoiceId: selectedInvoiceId || undefined,
        branchId: member.branch.id,
        amount: Number(amount),
        discount: discount ? Number(discount) : undefined,
        tax: tax ? Number(tax) : undefined,
        method,
        paymentDate,
        transactionReference: transactionReference || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: (payment) => {
          toast.success(`Payment ${payment.paymentNumber} recorded.`);
          router.push(`/payments/${payment.id}`);
        },
        onError: (err) => setError(toFinanceError(err).message),
      },
    );
  };

  const generateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !member) return;
    createPaymentLink.mutate(
      {
        memberId: member.id,
        membershipId: member.currentMembership?.id,
        invoiceId: selectedInvoiceId || undefined,
        branchId: member.branch.id,
        amount: Number(amount),
        discount: discount ? Number(discount) : undefined,
        tax: tax ? Number(tax) : undefined,
        notes: notes || undefined,
        notifyEmail,
        notifySms,
      },
      {
        onSuccess: (result) => {
          setLinkResult(result);
          setLinkStatus('PENDING');
          toast.success('Payment link generated.');
        },
        onError: (err) => setError(toFinanceError(err).message),
      },
    );
  };

  const copyLink = async () => {
    if (!linkResult) return;
    await navigator.clipboard.writeText(linkResult.shortUrl);
    toast.success('Link copied to clipboard.');
  };

  const checkStatus = () => {
    if (!linkResult) return;
    verifyPaymentStatus.mutate(linkResult.payment.id, {
      onSuccess: (result) => {
        setLinkStatus(result.status as LinkStatus);
        if (result.status === 'SUCCESS') {
          toast.success('Payment received!');
          router.push(`/payments/${linkResult.payment.id}`);
        } else if (result.status === 'FAILED') {
          toast.error('This payment link expired or was cancelled.');
        } else {
          toast.info('Not paid yet — check again once the member completes the payment.');
        }
      },
      onError: (err) => setError(toFinanceError(err).message),
    });
  };

  const resend = (medium: 'email' | 'sms') => {
    if (!linkResult) return;
    const mutation = medium === 'email' ? resendEmail : resendSms;
    mutation.mutate(
      { id: linkResult.payment.id, medium },
      {
        onSuccess: () => toast.success(`Payment link resent by ${medium === 'email' ? 'email' : 'SMS'}.`),
        onError: (err) => setError(toFinanceError(err).message),
      },
    );
  };

  const startOver = () => {
    setLinkResult(null);
    setLinkStatus(null);
    setAmount('');
    setDiscount('');
    setTax('');
    setNotes('');
  };

  const sym = currencySymbol;
  const amountNum = Number(amount) || 0;
  const remainingAfter = totalDue !== null ? Math.max(totalDue - finalAmount, 0) : null;
  const invoiceNote: React.ReactNode =
    selectedInvoice.data && remainingAfter !== null ? (
      channel === 'online' ? (
        <>Invoice {selectedInvoice.data.invoiceNumber} is updated once the member pays through the link.</>
      ) : (
        <>
          Invoice {selectedInvoice.data.invoiceNumber} will be marked{' '}
          <b style={{ color: 'var(--success)' }}>{remainingAfter < 0.005 ? 'Paid' : 'Partially paid'}</b>
          {remainingAfter >= 0.005 ? ` (${formatMoney(sym, remainingAfter)} remaining)` : ''}.
        </>
      )
    ) : channel === 'online' ? (
      'The payment stays pending until the member completes it on the gateway page.'
    ) : (
      'Not linked to an invoice.'
    );

  const showLinkPanel = channel === 'online' && linkResult;

  return (
    <form onSubmit={channel === 'online' ? generateLink : submitOffline} className="space-y-5">
      <PaymentsHero
        backHref="/payments"
        eyebrow="Finance · New"
        title="Record a payment"
        subtitle="Log cash or UPI taken at the desk, or send the member a secure payment link."
        aside={<HeroSteps hasMember={Boolean(member)} hasAmount={amountNum > 0} />}
      />

      <section className="flex flex-wrap items-start gap-3.5">
        <div className="flex min-w-0 flex-[2_1_640px] flex-col gap-3.5">
          <PanelCard className="p-6">
            <StepHeader n={1} title="Member" />
            <MemberCheckinSearch className="max-w-none" onSelect={setMember} placeholder="Search member by name, email, or member ID…" />
            {member ? <MemberSnapshot member={member} /> : <p className="mt-3 text-sm text-muted-foreground">Search and pick the member this payment is for.</p>}
          </PanelCard>

          <PanelCard className="p-6">
            <StepHeader n={2} title="Invoice" hint="optional" />
            {!member ? (
              <p className="text-sm text-muted-foreground">Select a member to see their outstanding invoices.</p>
            ) : (
              <div role="radiogroup" aria-label="Invoice" className="flex flex-wrap gap-3">
                {outstandingInvoices.map((inv) => (
                  <OptionCard key={inv.id} active={selectedInvoiceId === inv.id} onClick={() => setSelectedInvoiceId(inv.id)}>
                    <div className="flex justify-between gap-2 font-extrabold">
                      <span className="truncate">{inv.invoiceNumber}</span>
                      <span className="tabular-nums">{formatMoney(sym, inv.totalAmount)}</span>
                    </div>
                    <div className="mt-1 text-[13px] font-semibold text-muted-foreground">
                      Due {new Date(inv.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {inv.status === 'PARTIALLY_PAID' ? 'Partially paid' : 'Unpaid'}
                    </div>
                  </OptionCard>
                ))}
                <OptionCard active={selectedInvoiceId === ''} onClick={() => setSelectedInvoiceId('')}>
                  <div className="font-extrabold">No invoice</div>
                  <div className="mt-1 text-[13px] font-semibold text-muted-foreground">{invoices.isPending ? 'Checking invoices…' : outstandingInvoices.length === 0 ? 'No outstanding invoices for this member' : "Don't link this payment to an invoice"}</div>
                </OptionCard>
              </div>
            )}
            {selectedInvoice.data && totalDue !== null ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Invoice total <b className="text-foreground">{formatMoney(sym, selectedInvoice.data.totalAmount)}</b> · paid so far <b className="text-foreground">{formatMoney(sym, amountPaidSoFar)}</b> · due{' '}
                <b className="text-foreground">{formatMoney(sym, totalDue)}</b>
              </p>
            ) : null}
          </PanelCard>

          <PanelCard className="p-6">
            <StepHeader n={3} title="How is it being paid?" />
            {error ? (
              <p role="alert" className="mb-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            <div role="radiogroup" aria-label="Payment channel" className="mb-5 flex flex-wrap gap-3">
              <OptionCard active={channel === 'offline'} onClick={() => setChannel('offline')}>
                <div className="font-extrabold">Collected now</div>
                <div className="mt-1 text-[13px] font-semibold text-muted-foreground">Cash, UPI, cheque or transfer at the desk</div>
              </OptionCard>
              <OptionCard active={channel === 'online'} onClick={() => setChannel('online')}>
                <div className="flex items-center gap-2 font-extrabold">
                  <Link2 className="size-4" aria-hidden /> Send payment link
                </div>
                <div className="mt-1 text-[13px] font-semibold text-muted-foreground">Member pays online via the gateway</div>
              </OptionCard>
            </div>

            {showLinkPanel ? (
              <div className="space-y-3 rounded-2xl border border-dashed p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Payment link for <span className="font-medium text-foreground">{member?.name}</span>
                    {linkResult.notifiedEmail || linkResult.notifiedSms ? (
                      <>
                        {' '}
                        — sent by {[linkResult.notifiedEmail ? 'email' : null, linkResult.notifiedSms ? 'SMS' : null].filter(Boolean).join(' and ')}.
                      </>
                    ) : (
                      ' — not auto-sent; share the link yourself.'
                    )}
                  </p>
                  {linkStatus ? (
                    <Badge variant={linkStatus === 'SUCCESS' ? 'success' : linkStatus === 'FAILED' ? 'destructive' : 'warning'}>
                      {linkStatus === 'SUCCESS' ? 'Paid' : linkStatus === 'FAILED' ? 'Failed / expired' : 'Awaiting payment'}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={linkResult.shortUrl} onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" variant="outline" onClick={copyLink}>
                    <Copy className="size-4" /> Copy
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LoadingButton type="button" variant="outline" loading={verifyPaymentStatus.isPending} loadingText="Checking…" onClick={checkStatus}>
                    <RefreshCw className="size-4" /> Check payment status
                  </LoadingButton>
                  <LoadingButton type="button" variant="outline" size="sm" disabled={!hasEmail} loading={resendEmail.isPending} loadingText="Resending…" onClick={() => resend('email')}>
                    <Mail className="size-4" /> Resend by email
                  </LoadingButton>
                  <LoadingButton type="button" variant="outline" size="sm" disabled={!hasPhone} loading={resendSms.isPending} loadingText="Resending…" onClick={() => resend('sms')}>
                    <MessageSquare className="size-4" /> Resend by SMS
                  </LoadingButton>
                  <Button type="button" variant="ghost" onClick={startOver}>
                    Send a different link
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {channel === 'offline' ? (
                  <>
                    <FieldLabel className="mb-2.5 block">Method</FieldLabel>
                    <div role="radiogroup" aria-label="Payment method" className="mb-5 flex flex-wrap gap-2">
                      {OFFLINE_METHODS.map((m) => (
                        <Chip key={m.value} active={method === m.value} onClick={() => setMethod(m.value)} className="h-[38px] px-[15px]">
                          {m.label}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                  <div>
                    <FieldLabel className="mb-2 block">Amount</FieldLabel>
                    <MoneyInput id="paymentAmount" big value={amount} onChange={setAmount} />
                    {totalDue !== null && totalDue > 0 ? (
                      <div className="mt-2 flex gap-1.5">
                        <Chip small onClick={() => setAmount(totalDue.toFixed(2))}>
                          Full invoice
                        </Chip>
                        <Chip small onClick={() => setAmount((totalDue / 2).toFixed(2))}>
                          Half
                        </Chip>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel className="mb-2 block">Discount</FieldLabel>
                    <MoneyInput id="paymentDiscount" value={discount} onChange={setDiscount} />
                  </div>
                  <div>
                    <FieldLabel className="mb-2 block">Tax</FieldLabel>
                    <MoneyInput id="paymentTax" value={tax} onChange={setTax} />
                  </div>
                  {channel === 'offline' ? (
                    <>
                      <div>
                        <FieldLabel className="mb-2 block">Payment date</FieldLabel>
                        <Input id="paymentDate" type="date" className="h-12 rounded-xl" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                      </div>
                      <div className="col-span-full">
                        <FieldLabel className="mb-2 block">Transaction reference</FieldLabel>
                        <Input id="paymentReference" className="h-12 rounded-xl" value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="UPI ref / cheque no. (optional)" />
                      </div>
                    </>
                  ) : null}
                  <div className="col-span-full">
                    <FieldLabel className="mb-2 block">Notes</FieldLabel>
                    <textarea
                      id="paymentNotes"
                      placeholder="Internal note (optional)"
                      className="min-h-[84px] w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {channel === 'online' ? (
                  <div className="mt-[22px] rounded-2xl border border-dashed bg-muted/40 p-[18px]">
                    <div className="mb-1 font-extrabold">If sending a payment link</div>
                    <p className="mb-3 text-[13px] font-semibold text-muted-foreground">Both are off by default. Pick how the member is notified — or copy the link and share it yourself.</p>
                    <div className="flex flex-wrap gap-5 text-sm font-bold">
                      <label className="flex items-center gap-2.5">
                        <Checkbox checked={notifyEmail} disabled={!hasEmail} onCheckedChange={(v) => setNotifyEmail(v === true)} />
                        Email the link{!hasEmail && member ? <span className="font-medium text-muted-foreground">(no email on file)</span> : null}
                      </label>
                      <label className="flex items-center gap-2.5">
                        <Checkbox checked={notifySms} disabled={!hasPhone} onCheckedChange={(v) => setNotifySms(v === true)} />
                        SMS the link{!hasPhone && member ? <span className="font-medium text-muted-foreground">(no phone on file)</span> : null}
                      </label>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </PanelCard>
        </div>

        <div className="flex min-w-0 flex-[1_1_330px] flex-col gap-3.5 lg:sticky lg:top-4">
          <SummaryCard
            amount={amountNum}
            discount={Number(discount) || 0}
            tax={Number(tax) || 0}
            total={finalAmount}
            online={channel === 'online'}
            invoiceNote={invoiceNote}
            submit={
              <>
                {showLinkPanel ? null : channel === 'online' ? (
                  <LoadingButton type="submit" className="h-12 rounded-xl font-bold" loading={createPaymentLink.isPending} loadingText="Generating link…">
                    <Link2 className="size-4" /> Generate payment link
                  </LoadingButton>
                ) : (
                  <LoadingButton type="submit" className="h-12 rounded-xl font-bold" loading={createPayment.isPending} loadingText="Recording…">
                    Record {formatMoney(sym, finalAmount)} payment
                  </LoadingButton>
                )}
                <Button type="button" variant="outline" className="h-12 rounded-xl font-bold" onClick={() => router.push('/payments')}>
                  Cancel
                </Button>
              </>
            }
          />
          <RecentPaymentsCard memberId={member?.id} />
          <div className="rounded-[20px] border border-primary/25 bg-primary/10 p-5 text-[13px] font-semibold leading-relaxed text-primary">Card details are never entered here. Online payments go through the gateway link.</div>
        </div>
      </section>
    </form>
  );
}

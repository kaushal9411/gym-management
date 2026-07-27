'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Link2, Mail, MessageSquare, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import type { MemberListItem } from '@/features/members/types';
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
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

/** Offline/manual methods only — Online is its own dedicated Payment Link flow below, not a value staff pick from this dropdown. */
const OFFLINE_METHODS: { value: MemberPaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
];

type Channel = 'online' | 'offline';
type LinkStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export default function RecordPaymentPage() {
  const router = useRouter();
  const createPayment = useCreatePayment();
  const createPaymentLink = useCreatePaymentLink();
  const verifyPaymentStatus = useVerifyPaymentStatus();
  const resendEmail = useResendPaymentLinkNotification();
  const resendSms = useResendPaymentLinkNotification();

  const [channel, setChannel] = React.useState<Channel>('online');
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

  // Default both channels on whenever a member with that contact detail is
  // selected — staff can still uncheck one before generating the link.
  React.useEffect(() => {
    setNotifyEmail(Boolean(member?.email));
    setNotifySms(Boolean(member?.phone));
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
    if (!notifyEmail && !notifySms) {
      setError('Choose at least one way to notify the member, or share the link yourself once it’s generated.');
    }
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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/payments">
          <ArrowLeft className="size-4" /> Back to payments
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Record a payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={channel === 'online' ? generateLink : submitOffline} className="space-y-4">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel('online')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors',
                  channel === 'online' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Link2 className="size-4" /> Send Payment Link
              </button>
              <button
                type="button"
                onClick={() => setChannel('offline')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors',
                  channel === 'offline' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Wallet className="size-4" /> Offline / Mark as Paid
              </button>
            </div>

            <div className="space-y-2">
              <Label>Member</Label>
              <MemberCheckinSearch onSelect={setMember} placeholder="Search member by name, email, or member ID…" />
              {member ? (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{member.name}</span> ({member.memberId})
                  {member.currentMembership ? ` — on ${member.currentMembership.planName}` : ' — no active membership'}
                </p>
              ) : null}
            </div>

            {member && outstandingInvoices.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="settleInvoice">Settle an outstanding invoice (optional)</Label>
                <select
                  id="settleInvoice"
                  className={selectClassName}
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                >
                  <option value="">Don&apos;t link to an invoice</option>
                  {outstandingInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — ${inv.totalAmount} ({inv.status})
                    </option>
                  ))}
                </select>
                {selectedInvoice.data && totalDue !== null ? (
                  <p className="text-sm text-muted-foreground">
                    Invoice total: <span className="font-medium text-foreground">${selectedInvoice.data.totalAmount}</span> · Paid so far:{' '}
                    <span className="font-medium text-foreground">${amountPaidSoFar.toFixed(2)}</span> · Due amount:{' '}
                    <span className="font-medium text-foreground">${totalDue.toFixed(2)}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {channel === 'online' && linkResult ? (
              <div className="space-y-3 rounded-md border border-dashed p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Payment link for <span className="font-medium text-foreground">{member?.name}</span>
                    {linkResult.notifiedEmail || linkResult.notifiedSms ? (
                      <>
                        {' '}
                        — sent by{' '}
                        {[linkResult.notifiedEmail ? 'email' : null, linkResult.notifiedSms ? 'SMS' : null].filter(Boolean).join(' and ')}.
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
                  <LoadingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasEmail}
                    loading={resendEmail.isPending}
                    loadingText="Resending…"
                    onClick={() => resend('email')}
                  >
                    <Mail className="size-4" /> Resend by email
                  </LoadingButton>
                  <LoadingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasPhone}
                    loading={resendSms.isPending}
                    loadingText="Resending…"
                    onClick={() => resend('sms')}
                  >
                    <MessageSquare className="size-4" /> Resend by SMS
                  </LoadingButton>
                  <Button type="button" variant="ghost" onClick={startOver}>
                    Send a different link
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="paymentAmount">Paid amount</Label>
                    <Input id="paymentAmount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentDiscount">Discount</Label>
                    <Input id="paymentDiscount" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentTax">Tax</Label>
                    <Input id="paymentTax" type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Final amount: <span className="font-medium text-foreground">${finalAmount.toFixed(2)}</span>
                </p>

                {channel === 'offline' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="paymentMethod">Payment method</Label>
                      <select id="paymentMethod" className={selectClassName} value={method} onChange={(e) => setMethod(e.target.value as MemberPaymentMethod)}>
                        {OFFLINE_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentDate">Payment date</Label>
                      <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      Staff can&apos;t take card details here. Generate a secure payment link and send it to the member — they pay on Razorpay&apos;s own
                      hosted page via card, UPI, netbanking, or wallet.
                    </p>
                    <div className="space-y-2">
                      <Label>Notify the member</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={notifyEmail} disabled={!hasEmail} onCheckedChange={(v) => setNotifyEmail(v === true)} />
                          Email{!hasEmail ? <span className="text-muted-foreground">(no email on file)</span> : null}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={notifySms} disabled={!hasPhone} onCheckedChange={(v) => setNotifySms(v === true)} />
                          SMS{!hasPhone ? <span className="text-muted-foreground">(no phone on file)</span> : null}
                        </label>
                      </div>
                      {!notifyEmail && !notifySms ? (
                        <p className="text-sm text-muted-foreground">
                          Razorpay won&apos;t auto-send anything — you&apos;ll need to copy and share the link yourself.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {channel === 'offline' ? (
                  <div className="space-y-2">
                    <Label htmlFor="paymentReference">Transaction reference</Label>
                    <Input
                      id="paymentReference"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder="e.g. UPI txn ID, cheque number"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="paymentNotes">Notes</Label>
                  <textarea
                    id="paymentNotes"
                    className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {channel === 'online' ? (
                  <LoadingButton type="submit" className="w-full" loading={createPaymentLink.isPending} loadingText="Generating link…">
                    <Link2 className="size-4" /> Generate payment link
                  </LoadingButton>
                ) : (
                  <LoadingButton type="submit" className="w-full" loading={createPayment.isPending} loadingText="Recording…">
                    Mark as paid
                  </LoadingButton>
                )}
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

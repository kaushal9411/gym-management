'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import type { MemberListItem } from '@/features/members/types';
import { toFinanceError, useCreatePayment } from '@/features/finance/hooks/use-finance';
import type { MemberPaymentMethod } from '@/features/finance/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const METHODS: { value: MemberPaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ONLINE_GATEWAY', label: 'Online Gateway' },
];

export default function RecordPaymentPage() {
  const router = useRouter();
  const createPayment = useCreatePayment();

  const [member, setMember] = React.useState<MemberListItem | null>(null);
  const [amount, setAmount] = React.useState('');
  const [discount, setDiscount] = React.useState('');
  const [tax, setTax] = React.useState('');
  const [method, setMethod] = React.useState<MemberPaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [transactionReference, setTransactionReference] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const finalAmount = Math.max((Number(amount) || 0) - (Number(discount) || 0) + (Number(tax) || 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!member) {
      setError('Select a member first.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    createPayment.mutate(
      {
        memberId: member.id,
        membershipId: member.currentMembership?.id,
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
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

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

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Amount</Label>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment method</Label>
                <select id="paymentMethod" className={selectClassName} value={method} onChange={(e) => setMethod(e.target.value as MemberPaymentMethod)}>
                  {METHODS.map((m) => (
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

            <div className="space-y-2">
              <Label htmlFor="paymentReference">Transaction reference</Label>
              <Input
                id="paymentReference"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="e.g. UPI txn ID, cheque number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notes</Label>
              <textarea
                id="paymentNotes"
                className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <LoadingButton type="submit" className="w-full" loading={createPayment.isPending} loadingText="Recording…">
              Record payment
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

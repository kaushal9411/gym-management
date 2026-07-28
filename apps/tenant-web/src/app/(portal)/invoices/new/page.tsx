'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import type { MemberListItem } from '@/features/members/types';
import { toFinanceError, useGenerateInvoice } from '@/features/finance/hooks/use-finance';
import type { InvoiceItemInput } from '@/features/finance/types';

interface LineItemForm {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyLineItem(): LineItemForm {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, description: '', quantity: '1', unitPrice: '' };
}

export default function GenerateInvoicePage() {
  const router = useRouter();
  const generateInvoice = useGenerateInvoice();

  const [member, setMember] = React.useState<MemberListItem | null>(null);
  const [dueDate, setDueDate] = React.useState('');
  const [taxAmount, setTaxAmount] = React.useState('');
  const [discountAmount, setDiscountAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [items, setItems] = React.useState<LineItemForm[]>([emptyLineItem()]);
  const [error, setError] = React.useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const total = Math.max(subtotal - (Number(discountAmount) || 0) + (Number(taxAmount) || 0), 0);

  const updateItem = (key: string, patch: Partial<LineItemForm>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!member) {
      setError('Select a member first.');
      return;
    }
    const lineItems: InvoiceItemInput[] = items
      .filter((i) => i.description.trim() && Number(i.unitPrice) >= 0)
      .map((i) => ({ description: i.description, quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) }));
    if (lineItems.length === 0) {
      setError('Add at least one line item.');
      return;
    }

    generateInvoice.mutate(
      {
        memberId: member.id,
        branchId: member.branch.id,
        dueDate: dueDate || undefined,
        items: lineItems,
        taxAmount: taxAmount ? Number(taxAmount) : undefined,
        discountAmount: discountAmount ? Number(discountAmount) : undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: (invoice) => {
          toast.success(`Invoice ${invoice.invoiceNumber} generated.`);
          router.push(`/invoices/${invoice.id}`);
        },
        onError: (err) => setError(toFinanceError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/invoices">
          <ArrowLeft className="size-4" /> Back to invoices
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Generate an invoice</CardTitle>
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
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Line items</Label>
              <div className="space-y-2.5">
                {items.map((item, index) => (
                  <div key={item.key} className="flex items-end gap-2 rounded-lg border border-border bg-muted/20 p-2.5">
                    <span className="mb-2.5 hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">{index + 1}</span>
                    <div className="flex-1 space-y-1">
                      <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(item.key, { description: e.target.value })} />
                    </div>
                    <div className="w-20 space-y-1">
                      <Input type="number" min={1} placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(item.key, { quantity: e.target.value })} />
                    </div>
                    <div className="w-28 space-y-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Unit price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove line item"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.key)}
                      disabled={items.length <= 1}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyLineItem()])}>
                <Plus className="size-4" /> Add line item
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="invoiceDueDate">Due date</Label>
                <Input id="invoiceDueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceTax">Tax</Label>
                <Input id="invoiceTax" type="number" min={0} step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceDiscount">Discount</Label>
                <Input id="invoiceDiscount" type="number" min={0} step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Subtotal: ${subtotal.toFixed(2)} · Total: <span className="font-medium text-foreground">${total.toFixed(2)}</span>
            </p>

            <div className="space-y-2">
              <Label htmlFor="invoiceNotes">Notes</Label>
              <textarea
                id="invoiceNotes"
                className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <LoadingButton type="submit" className="w-full" loading={generateInvoice.isPending} loadingText="Generating…">
              Generate invoice
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

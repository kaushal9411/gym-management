'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import type { MemberListItem } from '@/features/members/types';
import { AmountInput, InvoiceSummaryCard, LineItemRow } from '@/features/finance/components/invoices/generate-invoice-parts';
import { PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { toYmd } from '@/features/finance/components/payments/payments-period';
import { Chip, FieldLabel, PanelCard } from '@/features/finance/components/payments/payments-ui';
import { HeroSteps, MemberSnapshot, StepHeader } from '@/features/finance/components/payments/record-payment-parts';
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

/** Quick due-date presets — they only fill the existing due-date input (local date, today + N). */
const DUE_PRESETS = [7, 15, 30];
const dueIn = (days: number) => {
  const d = new Date();
  return toYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
};

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

  const summaryLines = items
    .filter((i) => i.description.trim())
    .map((i) => ({ key: i.key, description: `${i.description}${Number(i.quantity) > 1 ? ` × ${i.quantity}` : ''}`, amount: (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0) }));

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentsHero
        backHref="/invoices"
        backLabel="Back to invoices"
        eyebrow="Finance · New"
        title="Generate an invoice"
        subtitle="Bill a member in advance — add line items, optional tax and discount, and a due date."
        aside={<HeroSteps hasMember={Boolean(member)} hasAmount={subtotal > 0} />}
      />

      <section className="flex flex-wrap items-start gap-3.5">
        <div className="flex min-w-0 flex-[2_1_640px] flex-col gap-3.5">
          <PanelCard className="p-6">
            <StepHeader n={1} title="Member" />
            <MemberCheckinSearch className="max-w-none" onSelect={setMember} placeholder="Search member by name, email, or member ID…" />
            {member ? <MemberSnapshot member={member} /> : <p className="mt-3 text-sm text-muted-foreground">Search and pick the member this invoice is for.</p>}
          </PanelCard>

          <PanelCard className="p-6">
            <StepHeader n={2} title="Line items" />
            {error ? (
              <p role="alert" className="mb-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-3">
              {items.map((item, index) => (
                <LineItemRow key={item.key} item={item} index={index} canRemove={items.length > 1} onChange={(patch) => updateItem(item.key, patch)} onRemove={() => removeItem(item.key)} />
              ))}
            </div>
            <Button type="button" variant="outline" className="mt-3 rounded-xl font-bold" onClick={() => setItems((prev) => [...prev, emptyLineItem()])}>
              <Plus className="size-4" /> Add line item
            </Button>
          </PanelCard>

          <PanelCard className="p-6">
            <StepHeader n={3} title="Terms" hint="all optional" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              <div>
                <FieldLabel className="mb-2 block">Due date</FieldLabel>
                <Input id="invoiceDueDate" aria-label="Due date" type="date" className="h-12 rounded-xl" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DUE_PRESETS.map((d) => (
                    <Chip key={d} small active={dueDate === dueIn(d)} onClick={() => setDueDate(dueIn(d))}>
                      In {d} days
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel className="mb-2 block">Discount</FieldLabel>
                <AmountInput id="invoiceDiscount" label="Discount" value={discountAmount} onChange={setDiscountAmount} />
              </div>
              <div>
                <FieldLabel className="mb-2 block">Tax</FieldLabel>
                <AmountInput id="invoiceTax" label="Tax" value={taxAmount} onChange={setTaxAmount} />
              </div>
              <div className="col-span-full">
                <FieldLabel className="mb-2 block">Notes</FieldLabel>
                <textarea
                  id="invoiceNotes"
                  placeholder="Shown on the invoice (optional)"
                  className="min-h-[84px] w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </PanelCard>
        </div>

        <div className="min-w-0 flex-[1_1_340px] lg:sticky lg:top-4">
          <InvoiceSummaryCard
            member={member}
            lines={summaryLines}
            subtotal={subtotal}
            discount={Number(discountAmount) || 0}
            tax={Number(taxAmount) || 0}
            total={total}
            dueDate={dueDate}
            notes={notes}
            submit={
              <LoadingButton type="submit" className="h-12 w-full rounded-xl text-[15px] font-bold" loading={generateInvoice.isPending} loadingText="Generating…">
                Generate invoice
              </LoadingButton>
            }
          />
        </div>
      </section>
    </form>
  );
}

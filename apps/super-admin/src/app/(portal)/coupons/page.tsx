'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { toCouponError, useCoupons, useCreateCoupon, useDeleteCoupon } from '@/features/coupons/hooks/use-coupons';
import type { Coupon, CouponScope, CouponType, UpsertCouponInput } from '@/features/coupons/types';

const EMPTY_FORM: UpsertCouponInput = {
  code: '',
  type: 'PERCENTAGE',
  scope: 'ONE_TIME',
  percentOff: 10,
  maxRedemptionsPerTenant: 1,
  isActive: true,
};

export default function CouponsPage() {
  const { data: coupons, isLoading } = useCoupons();
  const createCoupon = useCreateCoupon();
  const deleteCoupon = useDeleteCoupon();
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<UpsertCouponInput>(EMPTY_FORM);

  const submit = () => {
    createCoupon.mutate(form, {
      onSuccess: () => {
        toast.success('Coupon created');
        setCreating(false);
        setForm(EMPTY_FORM);
      },
      onError: (err) => toast.error(toCouponError(err).message),
    });
  };

  const columns: DataTableColumn<Coupon>[] = [
    { key: 'code', header: 'Code', render: (c) => <span className="font-mono font-medium">{c.code}</span> },
    { key: 'type', header: 'Type', render: (c) => c.type.replace('_', ' ') },
    { key: 'scope', header: 'Scope', render: (c) => c.scope.replace('_', ' ') },
    { key: 'discount', header: 'Discount', render: (c) => (c.type === 'PERCENTAGE' ? `${c.percentOff}%` : c.type === 'FIXED_AMOUNT' ? `${c.currency ?? ''} ${c.amountOff}` : `${c.trialExtensionDays}d trial`) },
    { key: 'usage', header: 'Redemptions', render: (c) => `${c.timesRedeemed}${c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}` },
    { key: 'expiresAt', header: 'Expires', render: (c) => (c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never') },
    { key: 'status', header: 'Status', render: (c) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{c.isActive ? 'Active' : 'Inactive'}</span> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (!window.confirm(`Delete coupon ${c.code}?`)) return;
            deleteCoupon.mutate(c.id, { onError: (err) => toast.error(toCouponError(err).message) });
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground">Discount codes — percentage, fixed amount, or trial extension.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Create coupon</Button>
      </div>

      {isLoading || !coupons ? <Skeleton className="h-72 rounded-xl" /> : <DataTable columns={columns} rows={coupons} rowKey={(c) => c.id} />}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create coupon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_AMOUNT">Fixed amount</option>
                  <option value="TRIAL_EXTENSION">Trial extension</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Scope</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as CouponScope })}>
                  <option value="ONE_TIME">One-time</option>
                  <option value="RECURRING">Recurring</option>
                  <option value="REFERRAL">Referral</option>
                </select>
              </div>
            </div>

            {form.type === 'PERCENTAGE' ? (
              <div className="space-y-1"><Label>Percent off</Label><Input type="number" value={form.percentOff ?? ''} onChange={(e) => setForm({ ...form, percentOff: Number(e.target.value) })} /></div>
            ) : form.type === 'FIXED_AMOUNT' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Amount off</Label><Input type="number" value={form.amountOff ?? ''} onChange={(e) => setForm({ ...form, amountOff: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Currency</Label><Input value={form.currency ?? 'USD'} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
              </div>
            ) : (
              <div className="space-y-1"><Label>Trial extension (days)</Label><Input type="number" value={form.trialExtensionDays ?? ''} onChange={(e) => setForm({ ...form, trialExtensionDays: Number(e.target.value) })} /></div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Max redemptions (total, optional)</Label><Input type="number" value={form.maxRedemptions ?? ''} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value ? Number(e.target.value) : undefined })} /></div>
              <div className="space-y-1"><Label>Max per tenant</Label><Input type="number" value={form.maxRedemptionsPerTenant} onChange={(e) => setForm({ ...form, maxRedemptionsPerTenant: Number(e.target.value) })} /></div>
            </div>

            <div className="space-y-1"><Label>Expires (optional)</Label><Input type="date" onChange={(e) => setForm({ ...form, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></div>

            <Button className="w-full" onClick={submit} disabled={createCoupon.isPending}>Create coupon</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

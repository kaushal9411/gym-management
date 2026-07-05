'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { toPlanError, useCreatePlan, useDeletePlan, usePlans, useSetPlanActive, useUpdatePlan } from '@/features/plans/hooks/use-plans';
import type { Plan, UpsertPlanInput } from '@/features/plans/types';

const EMPTY_FORM: UpsertPlanInput = {
  slug: '',
  name: '',
  description: '',
  priceMonthly: 0,
  priceYearly: 0,
  currency: 'USD',
  trialDays: 14,
  maxBranches: 1,
  maxManagers: 2,
  maxTrainers: 5,
  maxReceptionists: 2,
  maxStaff: 10,
  maxMembers: 200,
  maxStorageMb: 1024,
  sortOrder: 0,
  features: [],
};

export default function PlansPage() {
  const { data: plans, isLoading } = usePlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const setActive = useSetPlanActive();
  const deletePlan = useDeletePlan();

  const [editing, setEditing] = React.useState<Plan | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<UpsertPlanInput>(EMPTY_FORM);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreating(true);
  };

  const openEdit = (plan: Plan) => {
    setForm({
      slug: plan.slug,
      name: plan.name,
      description: plan.description ?? '',
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: Number(plan.priceYearly),
      currency: plan.currency,
      trialDays: plan.trialDays,
      maxBranches: plan.maxBranches,
      maxManagers: plan.maxManagers,
      maxTrainers: plan.maxTrainers,
      maxReceptionists: plan.maxReceptionists,
      maxStaff: plan.maxStaff,
      maxMembers: plan.maxMembers,
      maxStorageMb: plan.maxStorageMb,
      sortOrder: plan.sortOrder,
      features: plan.features,
    });
    setEditing(plan);
  };

  const submit = () => {
    if (creating) {
      createPlan.mutate(form, {
        onSuccess: () => {
          toast.success('Plan created');
          setCreating(false);
        },
        onError: (err) => toast.error(toPlanError(err).message),
      });
    } else if (editing) {
      updatePlan.mutate(
        { id: editing.id, input: form },
        {
          onSuccess: () => {
            toast.success('Plan updated');
            setEditing(null);
          },
          onError: (err) => toast.error(toPlanError(err).message),
        },
      );
    }
  };

  const columns: DataTableColumn<Plan>[] = [
    { key: 'name', header: 'Plan', render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'slug', header: 'Slug', render: (p) => p.slug },
    { key: 'price', header: 'Price (mo/yr)', render: (p) => `${p.currency} ${p.priceMonthly} / ${p.priceYearly}` },
    { key: 'trial', header: 'Trial', render: (p) => `${p.trialDays}d` },
    { key: 'subs', header: 'Active subs', render: (p) => p._count?.subscriptions ?? 0 },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <button
          onClick={() => setActive.mutate({ id: p.id, isActive: !p.isActive })}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
        >
          {p.isActive ? 'Active' : 'Disabled'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (!window.confirm(`Delete ${p.name}?`)) return;
              deletePlan.mutate(p.id, { onError: (err) => toast.error(toPlanError(err).message) });
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-muted-foreground">Subscription plan catalog — pricing, limits, features, trial days.</p>
        </div>
        <Button onClick={openCreate}>Create plan</Button>
      </div>

      {isLoading || !plans ? <Skeleton className="h-72 rounded-xl" /> : <DataTable columns={columns} rows={plans} rowKey={(p) => p.id} />}

      <Dialog open={creating || !!editing} onOpenChange={(open) => !open && (setCreating(false), setEditing(null))}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creating ? 'Create plan' : `Edit ${editing?.name}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} disabled={!creating} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Price / mo</Label><Input type="number" value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Price / yr</Label><Input type="number" value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Trial days</Label><Input type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Sort order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Storage (MB)</Label><Input type="number" value={form.maxStorageMb} onChange={(e) => setForm({ ...form, maxStorageMb: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Max branches</Label><Input type="number" value={form.maxBranches} onChange={(e) => setForm({ ...form, maxBranches: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Max managers</Label><Input type="number" value={form.maxManagers} onChange={(e) => setForm({ ...form, maxManagers: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Max trainers</Label><Input type="number" value={form.maxTrainers} onChange={(e) => setForm({ ...form, maxTrainers: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Max receptionists</Label><Input type="number" value={form.maxReceptionists} onChange={(e) => setForm({ ...form, maxReceptionists: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Max staff</Label><Input type="number" value={form.maxStaff} onChange={(e) => setForm({ ...form, maxStaff: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>Max members</Label><Input type="number" value={form.maxMembers} onChange={(e) => setForm({ ...form, maxMembers: Number(e.target.value) })} /></div>
            </div>

            <Button className="w-full" onClick={submit} disabled={createPlan.isPending || updatePlan.isPending}>
              {creating ? 'Create plan' : 'Save changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

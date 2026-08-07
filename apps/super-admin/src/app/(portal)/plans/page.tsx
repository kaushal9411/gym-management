'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, Users } from 'lucide-react';

import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanFormDialog } from '@/features/plans/components/plan-form-dialog';
import { toPlanError, useCreatePlan, useDeletePlan, usePlans, useSetPlanActive, useUpdatePlan } from '@/features/plans/hooks/use-plans';
import type { Plan, UpsertPlanInput } from '@/features/plans/types';

const EMPTY_FORM: UpsertPlanInput = {
  slug: '',
  name: '',
  description: '',
  priceMonthly: 0,
  priceYearly: 0,
  currency: 'INR',
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

function formatMoney(amount: string, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function PlansPage() {
  const router = useRouter();
  const { data: plans, isLoading } = usePlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const setActive = useSetPlanActive();
  const deletePlan = useDeletePlan();

  const [dialogMode, setDialogMode] = React.useState<'create' | Plan | null>(null);
  const [form, setForm] = React.useState<UpsertPlanInput>(EMPTY_FORM);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogMode('create');
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
    setDialogMode(plan);
  };

  const submit = () => {
    if (dialogMode === 'create') {
      createPlan.mutate(form, {
        onSuccess: () => {
          toast.success('Plan created');
          setDialogMode(null);
        },
        onError: (err) => toast.error(toPlanError(err).message),
      });
    } else if (dialogMode) {
      updatePlan.mutate(
        { id: dialogMode.id, input: form },
        {
          onSuccess: () => {
            toast.success('Plan updated');
            setDialogMode(null);
          },
          onError: (err) => toast.error(toPlanError(err).message),
        },
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--chart-7) 16%, transparent)',
              color: 'var(--chart-7)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-7) 18%, transparent)',
            }}
          >
            <CreditCard className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
            <p className="text-muted-foreground">Subscription plan catalog — click a plan for full details, subscribers, and upgrade/downgrade tools.</p>
          </div>
        </div>
        <Button onClick={openCreate}>Create plan</Button>
      </div>

      {isLoading || !plans ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.id}
              role="link"
              tabIndex={0}
              onClick={() => { notifyProgrammaticNavigation(`/plans/${p.id}`); router.push(`/plans/${p.id}`); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { notifyProgrammaticNavigation(`/plans/${p.id}`); router.push(`/plans/${p.id}`); } }}
              className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.slug}</p>
                  </div>
                  <Badge
                    variant={p.isActive ? 'success' : 'secondary'}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive.mutate({ id: p.id, isActive: !p.isActive });
                    }}
                  >
                    {p.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div>
                  <span className="text-3xl font-bold tracking-tight">{formatMoney(p.priceMonthly, p.currency)}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                  <span className="ml-2 text-xs text-muted-foreground">or {formatMoney(p.priceYearly, p.currency)}/yr</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {p.description ? <p className="text-sm text-muted-foreground">{p.description}</p> : null}
                <div className="flex items-center gap-1.5 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="font-medium">{p._count?.subscriptions ?? 0}</span>
                  <span className="text-muted-foreground">tenant{(p._count?.subscriptions ?? 0) === 1 ? '' : 's'} subscribed</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.trialDays}-day trial · up to {p.maxBranches} branch{p.maxBranches === 1 ? '' : 'es'} · {p.maxMembers} members</p>

                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- onClick here only stops this row's clicks from bubbling to the card's own click handler; the real interactive elements are the Buttons inside, already keyboard-accessible on their own. */}
                <div className="flex gap-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>Edit</Button>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanFormDialog
        mode={dialogMode}
        value={form}
        onChange={setForm}
        onSubmit={submit}
        submitting={createPlan.isPending || updatePlan.isPending}
        onOpenChange={(open) => !open && setDialogMode(null)}
      />
    </div>
  );
}

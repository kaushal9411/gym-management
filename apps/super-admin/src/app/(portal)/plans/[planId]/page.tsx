'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, CreditCard, X } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/data-table';
import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toBillingError, useChangePlan } from '@/features/billing/hooks/use-billing';
import type { PaymentLinkResult } from '@/features/billing/types';
import { PlanFormDialog } from '@/features/plans/components/plan-form-dialog';
import { toPlanError, usePlanById, usePlanSubscribers, usePlans, useUpdatePlan } from '@/features/plans/hooks/use-plans';
import type { Plan, PlanSubscriber, UpsertPlanInput } from '@/features/plans/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

function formatMoney(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'outline'> = {
  ACTIVE: 'success',
  TRIALING: 'warning',
  PAST_DUE: 'warning',
  GRACE: 'warning',
  SUSPENDED: 'destructive',
  CANCELED: 'outline',
  CANCELLED: 'outline',
  EXPIRED: 'outline',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status.replace('_', ' ')}</Badge>;
}

function ChangePlanDialog({
  subscriber,
  currentPlanId,
  plans,
  onClose,
}: {
  subscriber: PlanSubscriber | null;
  currentPlanId: string;
  plans: Plan[];
  onClose: () => void;
}) {
  const changePlan = useChangePlan(subscriber?.tenant.id ?? '');
  const [targetPlanId, setTargetPlanId] = React.useState('');
  const [linkResult, setLinkResult] = React.useState<PaymentLinkResult | null>(null);

  React.useEffect(() => {
    setTargetPlanId('');
    setLinkResult(null);
  }, [subscriber]);

  if (!subscriber) return null;
  const otherPlans = plans.filter((p) => p.isActive && p.id !== currentPlanId);

  const run = (mode: 'manual' | 'payment_link') => {
    if (!targetPlanId) {
      toast.error('Pick a plan first.');
      return;
    }
    changePlan.mutate(
      { planId: targetPlanId, mode },
      {
        onSuccess: (result) => {
          if (mode === 'manual') {
            toast.success(`${subscriber.tenant.name} moved to the new plan.`);
            onClose();
          } else {
            setLinkResult(result as PaymentLinkResult);
            toast.success('Payment link created — send it to the tenant.');
          }
        },
        onError: (err) => toast.error(toBillingError(err).message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan — {subscriber.tenant.name}</DialogTitle>
        </DialogHeader>

        {linkResult ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Send this link to the tenant to complete the switch once paid.</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={linkResult.shortUrl} className="h-9 text-xs" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(linkResult.shortUrl);
                  toast.success('Copied.');
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>New plan</Label>
              <select className={selectClassName} value={targetPlanId} onChange={(e) => setTargetPlanId(e.target.value)}>
                <option value="">Select a plan…</option>
                {otherPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.priceMonthly, p.currency)}/mo
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" disabled={changePlan.isPending} onClick={() => run('manual')}>
                Assign manually
              </Button>
              <Button disabled={changePlan.isPending} onClick={() => run('payment_link')}>
                Send payment link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Manually</strong> switches the plan immediately (e.g. paid offline). <strong>Send payment link</strong> generates a real Razorpay link — the
              plan switches automatically once paid.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const canManageBilling = useHasPermission('payments:manage');

  const { data: plan, isLoading } = usePlanById(params.planId);
  const { data: allPlans } = usePlans();
  const [page, setPage] = React.useState(1);
  const subscribers = usePlanSubscribers(params.planId, { page, limit: 10 });
  const updatePlan = useUpdatePlan();

  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<UpsertPlanInput | null>(null);
  const [changingPlanFor, setChangingPlanFor] = React.useState<PlanSubscriber | null>(null);

  const openEdit = () => {
    if (!plan) return;
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
    setEditing(true);
  };

  const submitEdit = () => {
    if (!plan || !form) return;
    updatePlan.mutate(
      { id: plan.id, input: form },
      {
        onSuccess: () => {
          toast.success('Plan updated');
          setEditing(false);
        },
        onError: (err) => toast.error(toPlanError(err).message),
      },
    );
  };

  if (isLoading || !plan) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const subscriberColumns: DataTableColumn<PlanSubscriber>[] = [
    {
      key: 'tenant',
      header: 'Tenant',
      render: (s) => (
        <span>
          <span className="block font-medium">{s.tenant.name}</span>
          <span className="block text-xs text-muted-foreground">{s.tenant.slug}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Subscription', render: (s) => <StatusBadge status={s.status} /> },
    { key: 'billingCycle', header: 'Cycle', render: (s) => s.billingCycle },
    { key: 'periodEnd', header: 'Period ends', render: (s) => (s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—') },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { notifyProgrammaticNavigation(`/tenants/${s.tenant.id}`); router.push(`/tenants/${s.tenant.id}`); }}>
            View tenant
          </Button>
          {canManageBilling ? (
            <Button size="sm" onClick={() => setChangingPlanFor(s)}>
              Change plan
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--chart-7) 16%, transparent)',
              color: 'var(--chart-7)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-7) 18%, transparent)',
            }}
          >
            <CreditCard className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              {plan.slug} <Badge variant={plan.isActive ? 'success' : 'secondary'}>{plan.isActive ? 'Active' : 'Disabled'}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { notifyProgrammaticNavigation('/plans'); router.push('/plans'); }}>Back to plans</Button>
          <Button onClick={openEdit}>Edit plan</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Package details</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {plan.description ? <p className="text-muted-foreground">{plan.description}</p> : null}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Price / mo</p><p className="font-medium">{formatMoney(plan.priceMonthly, plan.currency)}</p></div>
              <div><p className="text-xs text-muted-foreground">Price / yr</p><p className="font-medium">{formatMoney(plan.priceYearly, plan.currency)}</p></div>
              <div><p className="text-xs text-muted-foreground">Trial</p><p className="font-medium">{plan.trialDays} days</p></div>
              <div><p className="text-xs text-muted-foreground">Branches</p><p className="font-medium">{plan.maxBranches}</p></div>
              <div><p className="text-xs text-muted-foreground">Managers</p><p className="font-medium">{plan.maxManagers}</p></div>
              <div><p className="text-xs text-muted-foreground">Trainers</p><p className="font-medium">{plan.maxTrainers}</p></div>
              <div><p className="text-xs text-muted-foreground">Receptionists</p><p className="font-medium">{plan.maxReceptionists}</p></div>
              <div><p className="text-xs text-muted-foreground">Staff</p><p className="font-medium">{plan.maxStaff}</p></div>
              <div><p className="text-xs text-muted-foreground">Members</p><p className="font-medium">{plan.maxMembers}</p></div>
              <div><p className="text-xs text-muted-foreground">Storage</p><p className="font-medium">{plan.maxStorageMb} MB</p></div>
            </div>

            {plan.features.length > 0 ? (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs text-muted-foreground">Features</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  {plan.features.map((f) => (
                    <span key={f.key} className="flex items-center gap-1.5 text-sm">
                      {f.included ? <Check className="size-3.5 shrink-0 text-success" /> : <X className="size-3.5 shrink-0 text-muted-foreground" />}
                      <span className={f.included ? '' : 'text-muted-foreground'}>{f.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">At a glance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subscribers</span><span className="font-medium">{subscribers.data?.total ?? plan._count?.subscriptions ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sort order</span><span>{plan.sortOrder}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>{plan.currency}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Subscribers ({subscribers.data?.total ?? plan._count?.subscriptions ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {subscribers.isLoading || !subscribers.data ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : (
            <>
              <DataTable columns={subscriberColumns} rows={subscribers.data.items} rowKey={(s) => s.id} emptyMessage="No tenants on this plan yet." />
              <Pagination page={subscribers.data.page} totalPages={subscribers.data.totalPages} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {form ? (
        <PlanFormDialog
          mode={editing ? plan : null}
          value={form}
          onChange={setForm}
          onSubmit={submitEdit}
          submitting={updatePlan.isPending}
          onOpenChange={(open) => !open && setEditing(false)}
        />
      ) : null}

      <ChangePlanDialog subscriber={changingPlanFor} currentPlanId={plan.id} plans={allPlans ?? []} onClose={() => setChangingPlanFor(null)} />
    </div>
  );
}

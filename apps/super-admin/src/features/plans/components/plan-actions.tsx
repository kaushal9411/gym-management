'use client';

import * as React from 'react';
import { Copy, Loader2, Pencil, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineConfirm } from '@/features/tenants/components/detail/controls/confirm';
import { BANNER_BTN } from './banner';
import { useDuplicatePlan } from '../api/insights';
import { toPlanError, useDeletePlan, useSetPlanActive } from '../hooks/use-plans';
import type { Plan } from '../types';

export type PlanActionKind = 'edit' | 'duplicate' | 'toggle' | 'delete';

const subscriberCount = (p: Plan) => (p.stats ? p.stats.activeSubscribers + p.stats.trialSubscribers + p.stats.pastDueSubscribers : p._count?.subscriptions ?? 0);

/** Shared by the card grid/table and the detail banner: button row + the inline panel that opens under it (never a modal). */
export function usePlanActionState() {
  const [open, setOpen] = React.useState<PlanActionKind | null>(null);
  return { open, setOpen, toggleOpen: (k: PlanActionKind) => setOpen((o) => (o === k ? null : k)) };
}

const BTN = 'gap-1.5';

/** Outline button on cards/tables; translucent white button on the gradient banner. */
function ActBtn({ banner, danger, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { banner?: boolean; danger?: boolean }) {
  if (banner) return <button type="button" {...p} className={BANNER_BTN} />;
  return <Button type="button" size="sm" variant="outline" className={`${BTN} ${danger ? 'text-red-700 hover:text-red-700 dark:text-red-400' : ''} ${className ?? ''}`} {...p} />;
}

export function PlanActionButtons({ plan, open, onToggle, onEdit, banner }: { plan: Plan; open: PlanActionKind | null; onToggle: (k: PlanActionKind) => void; onEdit: () => void; banner?: boolean }) {
  const setActive = useSetPlanActive();
  const subs = subscriberCount(plan);
  const toggle = () => {
    // Enabling is harmless; disabling with live subscribers needs an explicit inline confirmation.
    if (plan.isActive && subs > 0) { onToggle('toggle'); return; }
    setActive.mutate({ id: plan.id, isActive: !plan.isActive }, {
      onSuccess: () => toast.success(plan.isActive ? `${plan.name} disabled` : `${plan.name} enabled`),
      onError: (e) => toast.error(toPlanError(e).message),
    });
  };
  return (
    <>
      <ActBtn banner={banner} aria-pressed={open === 'edit'} onClick={onEdit}><Pencil className="size-3.5" aria-hidden />Edit</ActBtn>
      <ActBtn banner={banner} aria-pressed={open === 'duplicate'} onClick={() => onToggle('duplicate')}><Copy className="size-3.5" aria-hidden />Duplicate</ActBtn>
      <ActBtn banner={banner} aria-pressed={open === 'toggle'} disabled={setActive.isPending} onClick={toggle}>
        {setActive.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Power className="size-3.5" aria-hidden />}{plan.isActive ? 'Disable' : 'Enable'}
      </ActBtn>
      <ActBtn banner={banner} danger aria-pressed={open === 'delete'} onClick={() => onToggle('delete')}><Trash2 className="size-3.5" aria-hidden />Delete</ActBtn>
    </>
  );
}

export function PlanActionPanel({ plan, kind, onClose, onDuplicated, onDeleted }: { plan: Plan; kind: PlanActionKind; onClose: () => void; onDuplicated?: (p: Plan) => void; onDeleted?: () => void }) {
  if (kind === 'duplicate') return <DuplicatePanel plan={plan} onClose={onClose} onDuplicated={onDuplicated} />;
  if (kind === 'toggle') return <ToggleConfirm plan={plan} onClose={onClose} />;
  if (kind === 'delete') return <DeleteConfirm plan={plan} onClose={onClose} onDeleted={onDeleted} />;
  return null;
}

function ToggleConfirm({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const setActive = useSetPlanActive();
  const subs = subscriberCount(plan);
  return (
    <InlineConfirm
      slug={plan.slug}
      onCancel={onClose}
      cfg={{
        title: `Disable ${plan.name}?`,
        text: `${subs} tenant${subs === 1 ? ' is' : 's are'} on this plan. They keep their current period, but an inactive plan cannot be self-service renewed or chosen by new tenants.`,
        label: 'Disable plan',
        destructive: true,
        pending: setActive.isPending,
        run: () => setActive.mutate({ id: plan.id, isActive: false }, {
          onSuccess: () => { toast.success(`${plan.name} disabled`); onClose(); },
          onError: (e) => toast.error(toPlanError(e).message),
        }),
      }}
    />
  );
}

function DeleteConfirm({ plan, onClose, onDeleted }: { plan: Plan; onClose: () => void; onDeleted?: () => void }) {
  const del = useDeletePlan();
  const [error, setError] = React.useState('');
  return (
    <div className="space-y-2">
      <InlineConfirm
        slug={plan.slug}
        onCancel={onClose}
        cfg={{
          title: `Delete ${plan.name}?`,
          text: 'This permanently removes the plan. Plans with active, trial, past-due or grace subscribers cannot be deleted — disable them instead.',
          label: 'Delete plan',
          destructive: true,
          slug: true,
          pending: del.isPending,
          run: () => { setError(''); del.mutate(plan.id, {
            onSuccess: () => { toast.success(`${plan.name} deleted`); onDeleted?.(); onClose(); },
            onError: (e) => setError(toPlanError(e).message),
          }); },
        }}
      />
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}
    </div>
  );
}

function DuplicatePanel({ plan, onClose, onDuplicated }: { plan: Plan; onClose: () => void; onDuplicated?: (p: Plan) => void }) {
  const dup = useDuplicatePlan();
  const [name, setName] = React.useState(`${plan.name} (copy)`);
  const [slug, setSlug] = React.useState('');
  const [error, setError] = React.useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    dup.mutate({ id: plan.id, body: { name: name.trim() || undefined, slug: slug.trim() || undefined } }, {
      onSuccess: (created) => { toast.success(`Created inactive copy "${created.name}"`); onDuplicated?.(created); onClose(); },
      onError: (err) => setError(toPlanError(err).message),
    });
  };
  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-lg border bg-muted/50 p-3 text-sm" aria-label={`Duplicate ${plan.name}`}>
      <p className="font-semibold">Duplicate {plan.name}</p>
      <p className="text-muted-foreground">Creates an inactive copy with the same prices, limits and features. Enable it when it is ready.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label htmlFor={`dn-${plan.id}`} className="mb-1 block text-xs text-muted-foreground">Name</label><Input id={`dn-${plan.id}`} className="h-9" value={name} onChange={(e) => { setName(e.target.value); }} /></div>
        <div><label htmlFor={`ds-${plan.id}`} className="mb-1 block text-xs text-muted-foreground">Slug (optional)</label><Input id={`ds-${plan.id}`} className="h-9 font-mono" placeholder={`${plan.slug}-copy`} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></div>
      </div>
      {error ? <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={dup.isPending}>{dup.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Create copy</Button>
        <Button type="button" size="sm" variant="outline" disabled={dup.isPending} onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

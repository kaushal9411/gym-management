'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Plan, UpsertPlanInput } from '../types';

interface PlanFormDialogProps {
  /** `null` closes the dialog. `'create'` or an existing `Plan` (edit) drives the title/slug-lock. */
  mode: 'create' | Plan | null;
  value: UpsertPlanInput;
  onChange: (value: UpsertPlanInput) => void;
  onSubmit: () => void;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shared Create/Edit form — used by the Plans card grid and the Plan Detail page's "Edit" button, so the ~24-field form only exists once. */
export function PlanFormDialog({ mode, value, onChange, onSubmit, submitting, onOpenChange }: PlanFormDialogProps) {
  const creating = mode === 'create';
  const set = <K extends keyof UpsertPlanInput>(key: K, next: UpsertPlanInput[K]) => onChange({ ...value, [key]: next });

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{creating ? 'Create plan' : `Edit ${mode && typeof mode !== 'string' ? mode.name : ''}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Slug</Label><Input value={value.slug} disabled={!creating} onChange={(e) => set('slug', e.target.value)} /></div>
            <div className="space-y-1"><Label>Name</Label><Input value={value.name} onChange={(e) => set('name', e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Description</Label><Input value={value.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Price / mo</Label><Input type="number" value={value.priceMonthly} onChange={(e) => set('priceMonthly', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Price / yr</Label><Input type="number" value={value.priceYearly} onChange={(e) => set('priceYearly', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Currency</Label><Input value={value.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Trial days</Label><Input type="number" value={value.trialDays} onChange={(e) => set('trialDays', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Sort order</Label><Input type="number" value={value.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Storage (MB)</Label><Input type="number" value={value.maxStorageMb} onChange={(e) => set('maxStorageMb', Number(e.target.value))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Max branches</Label><Input type="number" value={value.maxBranches} onChange={(e) => set('maxBranches', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Max managers</Label><Input type="number" value={value.maxManagers} onChange={(e) => set('maxManagers', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Max trainers</Label><Input type="number" value={value.maxTrainers} onChange={(e) => set('maxTrainers', Number(e.target.value))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Max receptionists</Label><Input type="number" value={value.maxReceptionists} onChange={(e) => set('maxReceptionists', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Max staff</Label><Input type="number" value={value.maxStaff} onChange={(e) => set('maxStaff', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Max members</Label><Input type="number" value={value.maxMembers} onChange={(e) => set('maxMembers', Number(e.target.value))} /></div>
          </div>

          <Button className="w-full" onClick={onSubmit} disabled={submitting}>
            {creating ? 'Create plan' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

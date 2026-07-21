'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { GymSettingsNav } from '@/features/gym-settings/components/gym-settings-nav';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import {
  toGymSettingsError,
  useInvoiceSettings,
  useUpdateInvoiceSettings,
} from '@/features/gym-settings/hooks/use-gym-settings';
import type { InvoiceSettings } from '@/features/gym-settings/types';

type InvoiceForm = Omit<InvoiceSettings, 'updatedAt'>;

export default function InvoiceSettingsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings:manage');

  const invoice = useInvoiceSettings();
  const updateInvoice = useUpdateInvoiceSettings();

  const [form, setForm] = React.useState<InvoiceForm | null>(null);

  React.useEffect(() => {
    if (invoice.data && !form) {
      const { updatedAt: _updatedAt, ...rest } = invoice.data;
      setForm(rest);
    }
  }, [invoice.data, form]);

  const baseline: InvoiceForm | null = invoice.data
    ? (({ updatedAt: _u, ...rest }) => rest)(invoice.data)
    : null;
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const handleCancel = () => {
    if (baseline) setForm(baseline);
  };

  const handleSave = async () => {
    if (!form) return;
    try {
      await updateInvoice.mutateAsync(form);
      toast.success('Invoice settings saved');
    } catch (error) {
      toast.error(toGymSettingsError(error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoice Settings</h1>
        <p className="text-muted-foreground">Defaults applied to invoices your gym issues to members (Payments module, coming soon).</p>
      </div>

      <GymSettingsNav />

      {invoice.isPending || !form ? (
        <Skeleton className="h-64 w-full" />
      ) : invoice.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load invoice settings — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar
              isDirty={isDirty}
              saving={updateInvoice.isPending}
              onSave={() => void handleSave()}
              onCancel={handleCancel}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice defaults</CardTitle>
              <CardDescription>Tax percentage is your default rate — it can still be overridden per invoice later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Invoice prefix</Label>
                  <Input
                    id="invoicePrefix"
                    value={form.invoicePrefix}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxPercentage">Tax percentage</Label>
                  <Input
                    id="taxPercentage"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.taxPercentage}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, taxPercentage: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultPaymentTermsDays">Default payment terms (days)</Label>
                  <Input
                    id="defaultPaymentTermsDays"
                    type="number"
                    min={0}
                    max={365}
                    value={form.defaultPaymentTermsDays}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, defaultPaymentTermsDays: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceFooter">Invoice footer</Label>
                <textarea
                  id="invoiceFooter"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="e.g. Thank you for your business!"
                  value={form.invoiceFooter ?? ''}
                  disabled={!canManage}
                  onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value || null })}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

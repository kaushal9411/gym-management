'use client';

import * as React from 'react';
import { Receipt, FileText, Hash } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { InvoicePreview } from '@/features/gym-settings/components/previews';
import { Field, SectionCard, SettingsLayout, textareaClassName } from '@/features/gym-settings/components/settings-ui';
import { SettingsHero } from '@/features/gym-settings/components/settings-hero';
import { StaggerGroup } from '@/features/reports/components/ui';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import {
  toGymSettingsError,
  useGymProfile,
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

  const profile = useGymProfile();

  return (
    <div className="space-y-5">
      <SettingsHero
        title="Invoice Settings"
        subtitle="Defaults applied to invoices your gym issues to members (Payments module, coming soon)."
        icon={Receipt}
        stats={form ? [{ label: 'Default tax', value: form.taxPercentage, format: 'number' }, { label: 'Terms (days)', value: form.defaultPaymentTermsDays, format: 'number' }] : undefined}
      />

      {invoice.isPending || !form ? (
        <Skeleton className="h-64 w-full rounded-[20px]" />
      ) : invoice.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load invoice settings — try refreshing.</p>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={updateInvoice.isPending} onSave={() => void handleSave()} onCancel={handleCancel} />
          ) : null}

          <SettingsLayout
            aside={
              <StaggerGroup className="space-y-5">
                <InvoicePreview prefix={form.invoicePrefix} taxPercentage={form.taxPercentage} termsDays={form.defaultPaymentTermsDays} footer={form.invoiceFooter} gymName={profile.data?.gymName ?? ''} />
              </StaggerGroup>
            }
          >
            <StaggerGroup className="space-y-5">
              <SectionCard tone="finance" icon={Hash} title="Numbering, tax & terms" subtitle="Tax percentage is your default rate — it can still be overridden per invoice later.">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Invoice prefix" htmlFor="invoicePrefix" required>
                    <Input id="invoicePrefix" value={form.invoicePrefix} disabled={!canManage} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
                  </Field>
                  <Field label="Tax percentage" htmlFor="taxPercentage">
                    <Input id="taxPercentage" type="number" min={0} max={100} step="0.01" value={form.taxPercentage} disabled={!canManage} onChange={(e) => setForm({ ...form, taxPercentage: Number(e.target.value) })} />
                  </Field>
                  <Field label="Default payment terms (days)" htmlFor="defaultPaymentTermsDays">
                    <Input id="defaultPaymentTermsDays" type="number" min={0} max={365} value={form.defaultPaymentTermsDays} disabled={!canManage} onChange={(e) => setForm({ ...form, defaultPaymentTermsDays: Number(e.target.value) })} />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard tone="members" icon={FileText} title="Invoice footer" subtitle="Printed at the bottom of every invoice.">
                <Field label="Invoice footer" htmlFor="invoiceFooter">
                  <textarea
                    id="invoiceFooter"
                    className={`${textareaClassName} min-h-20`}
                    placeholder="e.g. Thank you for your business!"
                    value={form.invoiceFooter ?? ''}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value || null })}
                  />
                </Field>
              </SectionCard>
            </StaggerGroup>
          </SettingsLayout>
        </>
      )}
    </div>
  );
}

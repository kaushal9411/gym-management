'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/components/ui/loading-button';
import { BillingHero } from '@/features/billing/components/billing-hero';
import { PanelCard } from '@/features/finance/components/payments/payments-ui';
import { toBillingError, useBillingAddress, useSaveBillingAddress } from '@/features/billing/hooks/use-billing';

const billingAddressSchema = z.object({
  legalName: z.string().trim().max(160).optional().or(z.literal('')),
  line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
  line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().trim().length(2, 'Use a 2-letter country code (e.g. US, IN, GB)').toUpperCase(),
  taxId: z.string().trim().max(40).optional().or(z.literal('')),
});

type BillingAddressFormValues = z.infer<typeof billingAddressSchema>;

export default function BillingAddressPage() {
  const { data: address, isLoading } = useBillingAddress();
  const saveAddress = useSaveBillingAddress();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<BillingAddressFormValues>({
    resolver: zodResolver(billingAddressSchema),
    values: address
      ? {
          legalName: address.legalName ?? '',
          line1: address.line1,
          line2: address.line2 ?? '',
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          taxId: address.taxId ?? '',
        }
      : undefined,
    defaultValues: { legalName: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: '', taxId: '' },
  });

  // Live preview of what's typed (react-hook-form watch — display only, no effect on validation/submit).
  const w = form.watch();
  const cityLine = [w.city?.trim(), [w.state?.trim(), w.postalCode?.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const hasAny = Object.values(w).some((v) => typeof v === 'string' && v.trim());

  const fieldError = (name: keyof BillingAddressFormValues) => form.formState.errors[name]?.message;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    saveAddress.mutate(
      {
        ...values,
        legalName: values.legalName || undefined,
        line2: values.line2 || undefined,
        taxId: values.taxId || undefined,
      },
      {
        onSuccess: () => toast.success('Billing address saved'),
        onError: (err) => setServerError(toBillingError(err).message),
      },
    );
  });

  return (
    <div className="space-y-6">
      <BillingHero subtitle="The address and tax ID printed on your FitCloud invoices." />

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <PanelCard title="Billing address" subtitle="Used to calculate tax and shown on invoices">
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <FormAlert variant="error" message={serverError} />

              <div className="space-y-2">
                <Label htmlFor="legalName">Legal / business name (optional)</Label>
                <Input id="legalName" {...form.register('legalName')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="line1">Address line 1</Label>
                <Input id="line1" invalid={!!fieldError('line1')} {...form.register('line1')} />
                {fieldError('line1') ? <p role="alert" className="text-xs text-destructive">{fieldError('line1')}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="line2">Address line 2 (optional)</Label>
                <Input id="line2" {...form.register('line2')} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" invalid={!!fieldError('city')} {...form.register('city')} />
                  {fieldError('city') ? <p role="alert" className="text-xs text-destructive">{fieldError('city')}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State / region</Label>
                  <Input id="state" invalid={!!fieldError('state')} {...form.register('state')} />
                  {fieldError('state') ? <p role="alert" className="text-xs text-destructive">{fieldError('state')}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal code</Label>
                  <Input id="postalCode" invalid={!!fieldError('postalCode')} {...form.register('postalCode')} />
                  {fieldError('postalCode') ? <p role="alert" className="text-xs text-destructive">{fieldError('postalCode')}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country code</Label>
                  <Input id="country" placeholder="US" invalid={!!fieldError('country')} {...form.register('country')} />
                  {fieldError('country') ? <p role="alert" className="text-xs text-destructive">{fieldError('country')}</p> : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / GST number (optional)</Label>
                <Input id="taxId" {...form.register('taxId')} />
              </div>

              <LoadingButton type="submit" loading={saveAddress.isPending} loadingText="Saving…">
                Save billing address
              </LoadingButton>
            </form>
          </PanelCard>

          <PanelCard title="Invoice preview" subtitle="How your details will appear on invoices" className="lg:sticky lg:top-6">
            <div className="rounded-2xl border bg-muted/40 p-5 text-sm">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden /> Billed to
              </p>
              {hasAny ? (
                <address className="space-y-0.5 not-italic">
                  {w.legalName?.trim() ? <p className="text-base font-extrabold">{w.legalName.trim()}</p> : null}
                  {w.line1?.trim() ? <p>{w.line1.trim()}</p> : null}
                  {w.line2?.trim() ? <p>{w.line2.trim()}</p> : null}
                  {cityLine ? <p>{cityLine}</p> : null}
                  {w.country?.trim() ? <p>{w.country.trim().toUpperCase()}</p> : null}
                  {w.taxId?.trim() ? <p className="pt-2 text-xs font-semibold text-muted-foreground">Tax ID: {w.taxId.trim()}</p> : null}
                </address>
              ) : (
                <p className="text-muted-foreground">Start typing to preview your invoice address.</p>
              )}
            </div>
          </PanelCard>
        </div>
      )}
    </div>
  );
}

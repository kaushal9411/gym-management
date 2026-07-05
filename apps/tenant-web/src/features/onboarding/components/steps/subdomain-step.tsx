'use client';

import * as React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { SUBDOMAIN_DEBOUNCE_MS } from '../../constants';
import { useCheckSubdomain } from '../../hooks/use-onboarding';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { subdomainFormSchema, type SubdomainFormValues } from '../../schemas';
import { useOnboardingWizard } from '../../store/onboarding-wizard-context';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Step 4 — pick and live-check the tenant's subdomain (`{slug}.fitcloud.com`). */
export function SubdomainStep() {
  const { state, dispatch } = useOnboardingWizard();

  const form = useForm<SubdomainFormValues>({
    resolver: zodResolver(subdomainFormSchema),
    defaultValues: { subdomain: state.subdomain ?? slugify(state.gymName ?? '') },
  });

  const subdomain = form.watch('subdomain');
  const debounced = useDebouncedValue(subdomain, SUBDOMAIN_DEBOUNCE_MS);
  const isValidShape = subdomainFormSchema.shape.subdomain.safeParse(debounced).success;

  const { data: check, isFetching } = useCheckSubdomain(debounced, isValidShape);

  const onSubmit = form.handleSubmit((values) => {
    if (!check?.available || check.slug !== values.subdomain) return;
    dispatch({ type: 'SUBDOMAIN_CHOSEN', subdomain: values.subdomain });
  });

  const showResult = isValidShape && debounced === subdomain && !isFetching && check;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="subdomain">Your portal address</Label>
        <div className="flex items-stretch">
          <Input
            id="subdomain"
            placeholder="goldgym"
            className="rounded-r-none"
            invalid={!!form.formState.errors.subdomain || (showResult && !check.available)}
            {...form.register('subdomain')}
          />
          <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            .fitcloud.com
          </span>
        </div>

        {form.formState.errors.subdomain ? (
          <p role="alert" className="text-xs text-destructive">{form.formState.errors.subdomain.message}</p>
        ) : isFetching && isValidShape ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Checking availability…
          </p>
        ) : showResult ? (
          check.available ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success">
              <Check className="size-3.5" aria-hidden /> {subdomain}.fitcloud.com is available
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <X className="size-3.5" aria-hidden /> {check.reason ?? 'That address is already taken.'}
              </p>
              {check.suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {check.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => form.setValue('subdomain', s, { shouldValidate: true })}
                      className={cn(
                        'rounded-full border border-input bg-muted px-2.5 py-1 text-xs transition-colors hover:bg-accent',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            {subdomain ? `Your team will sign in at ${subdomain}.fitcloud.com` : 'Lowercase letters, numbers and hyphens.'}
          </p>
        )}
      </div>

      <LoadingButton
        type="submit"
        className="w-full"
        disabled={!showResult || !check.available}
      >
        Continue
      </LoadingButton>
    </form>
  );
}

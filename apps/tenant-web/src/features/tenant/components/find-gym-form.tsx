'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { slugSchema } from '@/features/auth/schemas';
import { listActiveTenants } from '@/features/tenant/list-active';
import { buildTenantLoginUrl } from '@/features/tenant/subdomain-urls';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';

const findGymSchema = z.object({ slug: slugSchema });
type FindGymFormValues = z.infer<typeof findGymSchema>;

interface FindGymFormProps {
  /**
   * Skips this component's own `AuthHeader`+`Card` chrome and renders just
   * the form fields — for a consumer (the redesigned `/login` page) that
   * wants to place this inside its own premium shell/card instead. Schema,
   * validation, and submit behavior are identical either way. Defaults to
   * `false` so every existing call site is visually unchanged.
   */
  bare?: boolean;
  /** Only meaningful with `bare` — forces the fixed dark-glass field/button chrome used by the neon login redesign, instead of the theme-reactive default. */
  dark?: boolean;
}

/**
 * A plain "pick your gym from the list" form. The bare-host login page now
 * asks for credentials first (the gym is discovered from them — see
 * `platform-login.ts`); this stays as the escape hatch for the things that
 * need a gym before any credentials exist (forgot password, phone-number
 * login), reached via "Choose your gym instead" on that page.
 */
export function FindGymForm({ bare = false, dark = false }: FindGymFormProps) {
  const tenant = useTenant();
  const form = useForm<FindGymFormValues>({
    resolver: zodResolver(findGymSchema),
    defaultValues: { slug: '' },
  });

  // Public, unauthenticated — GET /public/tenants was built specifically for
  // this "pre-login pick your gym" picker (name/slug/logo only, excludes
  // suspended/cancelled/maintenance-mode tenants a login couldn't succeed
  // against anyway).
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['public-tenants'],
    queryFn: listActiveTenants,
    staleTime: 60_000,
  });

  const onSubmit = form.handleSubmit(({ slug }) => {
    window.location.href = buildTenantLoginUrl(slug);
  });

  const noGymsFound = !isLoading && (tenants?.length ?? 0) === 0;

  const fields = (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="slug" className={dark ? 'text-xs font-medium uppercase tracking-wide text-foreground/60' : undefined}>
          Your gym
        </Label>
        <Select
          id="slug"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: the sole field on a single-purpose "find your gym" form.
          autoFocus
          invalid={!!form.formState.errors.slug}
          aria-describedby={form.formState.errors.slug ? 'slug-error' : undefined}
          disabled={isLoading || noGymsFound}
          defaultValue=""
          className={cn(
            bare && 'h-12 text-[15px]',
            dark && 'border-foreground/10 bg-foreground/4 text-foreground focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20',
          )}
          {...form.register('slug')}
        >
          <option value="" disabled className={dark ? 'bg-background text-foreground/50' : undefined}>
            {isLoading ? 'Loading gyms…' : noGymsFound ? 'No gyms found' : 'Select your gym'}
          </option>
          {tenants?.map((tenant) => (
            <option key={tenant.slug} value={tenant.slug} className={dark ? 'bg-background text-foreground' : undefined}>
              {tenant.name}
            </option>
          ))}
        </Select>
        {form.formState.errors.slug ? (
          <p id="slug-error" role="alert" className={cn('text-xs', dark ? 'text-red-400' : 'text-destructive')}>
            {form.formState.errors.slug.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={isLoading || noGymsFound}
        className={cn(
          bare && 'h-12 w-full border-0 text-[15px] font-bold uppercase tracking-wide shadow-lg',
          dark
            ? 'text-white shadow-[0_8px_24px_-6px_rgba(255,90,31,0.55)] hover:shadow-[0_16px_36px_-8px_rgba(255,90,31,0.7)] hover:-translate-y-0.5 transition-transform'
            : bare && 'gradient-brand font-semibold normal-case',
        )}
        style={dark ? { backgroundImage: 'linear-gradient(135deg, #ff8a3d 0%, #ff5a1f 45%, #e0271b 100%)' } : undefined}
      >
        <Search className="size-4" />
        Continue
      </Button>
    </form>
  );

  if (bare) {
    return (
      <>
        {fields}
        <p className={cn('mt-6 text-center text-sm', dark ? 'text-foreground/40' : 'text-muted-foreground')}>
          New to {tenant.platformName}?{' '}
          {dark ? (
            <Link href={AUTH_ROUTES.register} className="font-medium text-cyan-700 dark:text-cyan-300 underline-offset-4 hover:underline">
              Register your gym
            </Link>
          ) : (
            <Button asChild variant="link" className="h-auto p-0 text-sm">
              <Link href={AUTH_ROUTES.register}>Register your gym</Link>
            </Button>
          )}
        </p>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Looking for your gym?"
        subtitle="Select your gym from the list to continue to its sign-in page."
      />

      <Card>
        <CardContent className="space-y-4 p-6 sm:p-8">{fields}</CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        New to {tenant.platformName}?{' '}
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href={AUTH_ROUTES.register}>Register your gym</Link>
        </Button>
      </p>
    </div>
  );
}

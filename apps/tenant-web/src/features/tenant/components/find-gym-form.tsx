'use client';

import * as React from 'react';
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
import { getRememberedGymSlug, setRememberedGymSlug } from '@/features/tenant/remember-gym';
import { buildTenantLoginUrl } from '@/features/tenant/subdomain-urls';
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
 * Shown instead of the login form whenever no real gym subdomain resolved
 * (bare host / apex domain) — a login form that can never succeed is worse
 * than no form at all, so this replaces it with a way to actually get
 * somewhere useful.
 */
export function FindGymForm({ bare = false, dark = false }: FindGymFormProps) {
  const form = useForm<FindGymFormValues>({
    resolver: zodResolver(findGymSchema),
    defaultValues: { slug: '' },
  });

  // A previous visit already picked a gym — skip straight to its login
  // instead of asking again. Starts `null` (matches the server-rendered
  // markup — localStorage doesn't exist there) and is only ever read after
  // mount, same "client-only prefill" pattern as `remember-me.ts`'s
  // `getRememberedEmail`; reading it during the initial render instead
  // would desync from the server output and trip a hydration mismatch.
  //
  // `?changeGym=1` is the tenant login screen's "Change gym" link signaling
  // back here (it can't clear this storage directly — different origin,
  // see remember-gym.ts) — forget the old pick and show the picker instead
  // of bouncing straight back to it.
  const [remembered, setRemembered] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('changeGym')) {
      setRememberedGymSlug(null);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    const slug = getRememberedGymSlug();
    if (slug) {
      setRemembered(slug);
      window.location.href = buildTenantLoginUrl(slug);
    }
  }, []);

  // Public, unauthenticated — GET /public/tenants was built specifically for
  // this "pre-login pick your gym" picker (name/slug/logo only, excludes
  // suspended/cancelled/maintenance-mode tenants a login couldn't succeed
  // against anyway). `enabled: !remembered` is best-effort, not a guarantee
  // — on a remembered-slug mount both effects fire around the same time, so
  // this may still request once before navigation away; harmless either way.
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['public-tenants'],
    queryFn: listActiveTenants,
    staleTime: 60_000,
    enabled: !remembered,
  });

  const onSubmit = form.handleSubmit(({ slug }) => {
    setRememberedGymSlug(slug);
    window.location.href = buildTenantLoginUrl(slug);
  });

  const noGymsFound = !isLoading && (tenants?.length ?? 0) === 0;

  if (remembered) {
    return <p className={cn('text-center text-sm', dark ? 'text-white/40' : 'text-muted-foreground')}>Redirecting to your gym…</p>;
  }

  const fields = (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="slug" className={dark ? 'text-xs font-medium uppercase tracking-wide text-white/60' : undefined}>
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
            dark && 'border-white/10 bg-white/4 text-white focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20',
          )}
          {...form.register('slug')}
        >
          <option value="" disabled className={dark ? 'bg-neutral-900 text-white/50' : undefined}>
            {isLoading ? 'Loading gyms…' : noGymsFound ? 'No gyms found' : 'Select your gym'}
          </option>
          {tenants?.map((tenant) => (
            <option key={tenant.slug} value={tenant.slug} className={dark ? 'bg-neutral-900 text-white' : undefined}>
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
        <p className={cn('mt-6 text-center text-sm', dark ? 'text-white/40' : 'text-muted-foreground')}>
          New to FitCloud?{' '}
          {dark ? (
            <Link href={AUTH_ROUTES.register} className="font-medium text-cyan-300 underline-offset-4 hover:underline">
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
        New to FitCloud?{' '}
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href={AUTH_ROUTES.register}>Register your gym</Link>
        </Button>
      </p>
    </div>
  );
}

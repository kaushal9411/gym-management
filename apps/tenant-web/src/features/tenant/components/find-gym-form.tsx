'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { slugSchema } from '@/features/auth/schemas';
import { cn } from '@/lib/utils';

const findGymSchema = z.object({ slug: slugSchema });
type FindGymFormValues = z.infer<typeof findGymSchema>;

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'fitcloud.local';

/**
 * Builds the target subdomain URL from the CURRENT host, so this works
 * identically in every environment without hardcoding a domain: on
 * `{x}.localhost:3001` or plain `localhost:3001` it targets
 * `{slug}.localhost:<port>` (browser-native dev subdomains); anywhere else
 * it targets `{slug}.<platform domain>`.
 */
function buildTenantLoginUrl(slug: string): string {
  const { protocol, hostname, port } = window.location;
  const isLocalDev = hostname === 'localhost' || hostname.endsWith('.localhost');
  const host = isLocalDev ? `${slug}.localhost${port ? `:${port}` : ''}` : `${slug}.${PLATFORM_DOMAIN}`;
  return `${protocol}//${host}/login`;
}

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

  const onSubmit = form.handleSubmit(({ slug }) => {
    window.location.href = buildTenantLoginUrl(slug);
  });

  const fields = (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="slug" className={dark ? 'text-xs font-medium uppercase tracking-wide text-white/60' : undefined}>
          Gym subdomain
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="slug"
            placeholder="yourgym"
            autoComplete="off"
            autoFocus
            invalid={!!form.formState.errors.slug}
            aria-describedby={form.formState.errors.slug ? 'slug-error' : undefined}
            className={cn(
              bare && 'h-12 text-[15px]',
              dark && 'border-white/10 bg-white/4 text-white placeholder:text-white/35 focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20',
            )}
            {...form.register('slug')}
          />
          <span className={cn('shrink-0 text-sm', dark ? 'text-white/40' : 'text-muted-foreground')}>.{PLATFORM_DOMAIN}</span>
        </div>
        {form.formState.errors.slug ? (
          <p id="slug-error" role="alert" className={cn('text-xs', dark ? 'text-red-400' : 'text-destructive')}>
            {form.formState.errors.slug.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
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
        subtitle="Enter your gym's FitCloud subdomain to continue to its sign-in page."
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

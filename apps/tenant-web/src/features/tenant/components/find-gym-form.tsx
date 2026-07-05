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

/**
 * Shown instead of the login form whenever no real gym subdomain resolved
 * (bare host / apex domain) — a login form that can never succeed is worse
 * than no form at all, so this replaces it with a way to actually get
 * somewhere useful.
 */
export function FindGymForm() {
  const form = useForm<FindGymFormValues>({
    resolver: zodResolver(findGymSchema),
    defaultValues: { slug: '' },
  });

  const onSubmit = form.handleSubmit(({ slug }) => {
    window.location.href = buildTenantLoginUrl(slug);
  });

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Looking for your gym?"
        subtitle="Enter your gym's FitCloud subdomain to continue to its sign-in page."
      />

      <Card>
        <CardContent className="space-y-4 p-6 sm:p-8">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Gym subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="slug"
                  placeholder="yourgym"
                  autoComplete="off"
                  autoFocus
                  invalid={!!form.formState.errors.slug}
                  aria-describedby={form.formState.errors.slug ? 'slug-error' : undefined}
                  {...form.register('slug')}
                />
                <span className="shrink-0 text-sm text-muted-foreground">.{PLATFORM_DOMAIN}</span>
              </div>
              {form.formState.errors.slug ? (
                <p id="slug-error" role="alert" className="text-xs text-destructive">
                  {form.formState.errors.slug.message}
                </p>
              ) : null}
            </div>

            <Button type="submit" className="w-full">
              <Search className="size-4" />
              Continue
            </Button>
          </form>
        </CardContent>
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

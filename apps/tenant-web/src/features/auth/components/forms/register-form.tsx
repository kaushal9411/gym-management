'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '../../constants';
import { toAuthError, useRegisterGym } from '../../hooks/use-auth';
import { registerGymSchema, type RegisterGymFormValues } from '../../schemas';
import { AuthHeader } from '../auth-header';
import { FormAlert } from '../form-alert';
import { LoadingButton } from '../loading-button';
import { PasswordInput } from '../password-input';
import { PasswordStrengthMeter } from '../password-strength-meter';

/** Gym-owner registration — entered from the marketing site's pricing CTA. */
export function RegisterForm() {
  const router = useRouter();
  const registerGym = useRegisterGym();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<RegisterGymFormValues>({
    resolver: zodResolver(registerGymSchema),
    defaultValues: {
      gymName: '',
      slug: '',
      ownerName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const passwordValue = form.watch('password');
  const slugValue = form.watch('slug');

  // Suggest a slug from the gym name until the user edits the slug manually.
  const slugTouched = form.formState.dirtyFields.slug;
  const gymName = form.watch('gymName');
  React.useEffect(() => {
    if (slugTouched) return;
    const suggested = gymName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    form.setValue('slug', suggested, { shouldValidate: gymName.length > 0 });
  }, [gymName, slugTouched, form]);

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    registerGym.mutate(values, {
      onSuccess: ({ email }) => {
        router.push(`${AUTH_ROUTES.verifyEmail}?status=pending&email=${encodeURIComponent(email)}`);
      },
      onError: (error) => {
        const authError = toAuthError(error);
        if (authError.code === 'SLUG_TAKEN') {
          form.setError('slug', { message: authError.message });
          return;
        }
        setServerError(authError.message);
      },
    });
  });

  const isSubmitting = registerGym.isPending;
  const fieldError = (name: keyof RegisterGymFormValues) => form.formState.errors[name]?.message;

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Create your gym on FitCloud"
        subtitle="14-day free trial · no credit card required"
      />

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <FormAlert variant="error" message={serverError} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gymName">Gym name</Label>
              <Input
                id="gymName"
                placeholder="Gold's Gym"
                invalid={!!fieldError('gymName')}
                disabled={isSubmitting}
                {...form.register('gymName')}
              />
              {fieldError('gymName') ? (
                <p role="alert" className="text-xs text-destructive">{fieldError('gymName')}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Your portal address</Label>
              <div className="flex items-stretch">
                <Input
                  id="slug"
                  placeholder="goldgym"
                  className="rounded-r-none"
                  invalid={!!fieldError('slug')}
                  aria-describedby="slug-preview"
                  disabled={isSubmitting}
                  {...form.register('slug')}
                />
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                  .fitcloud.com
                </span>
              </div>
              <p id="slug-preview" className="text-xs text-muted-foreground">
                {slugValue ? `Your team will sign in at ${slugValue}.fitcloud.com` : 'Lowercase letters, numbers and hyphens.'}
              </p>
              {fieldError('slug') ? (
                <p role="alert" className="text-xs text-destructive">{fieldError('slug')}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ownerName">Your name</Label>
                <Input
                  id="ownerName"
                  autoComplete="name"
                  placeholder="Arjun Mehta"
                  invalid={!!fieldError('ownerName')}
                  disabled={isSubmitting}
                  {...form.register('ownerName')}
                />
                {fieldError('ownerName') ? (
                  <p role="alert" className="text-xs text-destructive">{fieldError('ownerName')}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="owner@goldgym.com"
                  invalid={!!fieldError('email')}
                  disabled={isSubmitting}
                  {...form.register('email')}
                />
                {fieldError('email') ? (
                  <p role="alert" className="text-xs text-destructive">{fieldError('email')}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                invalid={!!fieldError('password')}
                disabled={isSubmitting}
                {...form.register('password')}
              />
              <PasswordStrengthMeter password={passwordValue} />
              {fieldError('password') ? (
                <p role="alert" className="text-xs text-destructive">{fieldError('password')}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                invalid={!!fieldError('confirmPassword')}
                disabled={isSubmitting}
                {...form.register('confirmPassword')}
              />
              {fieldError('confirmPassword') ? (
                <p role="alert" className="text-xs text-destructive">{fieldError('confirmPassword')}</p>
              ) : null}
            </div>

            <Controller
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="acceptTerms"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      disabled={isSubmitting}
                      className="mt-0.5"
                    />
                    <Label htmlFor="acceptTerms" className="cursor-pointer font-normal leading-snug text-muted-foreground">
                      I agree to the{' '}
                      <Link href="#" className="text-primary underline-offset-4 hover:underline">Terms of Service</Link>{' '}
                      and{' '}
                      <Link href="#" className="text-primary underline-offset-4 hover:underline">Privacy Policy</Link>
                    </Label>
                  </div>
                  {fieldError('acceptTerms') ? (
                    <p role="alert" className="text-xs text-destructive">{fieldError('acceptTerms')}</p>
                  ) : null}
                </div>
              )}
            />

            <LoadingButton type="submit" className="w-full" loading={isSubmitting} loadingText="Creating your gym…">
              Create my gym
            </LoadingButton>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Already using FitCloud?{' '}
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href={AUTH_ROUTES.login}>Sign in</Link>
        </Button>
      </p>
    </div>
  );
}

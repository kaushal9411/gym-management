'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ADMIN_ROUTES } from '@/constants/routes';
import { toAdminError, useLogin } from '../hooks/use-auth';
import { FormAlert } from './form-alert';
import { LoadingButton } from './loading-button';
import { PasswordInput } from './password-input';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const fieldError = (name: keyof LoginFormValues) => form.formState.errors[name]?.message;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    login.mutate(values, {
      onSuccess: () => router.push(ADMIN_ROUTES.dashboard),
      onError: (error) => setServerError(toAdminError(error).message),
    });
  });

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">FitCloud Admin</h1>
        <p className="text-sm text-muted-foreground">Internal Super Admin portal — gym owners cannot sign in here.</p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <FormAlert variant="error" message={serverError} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" invalid={!!fieldError('email')} disabled={login.isPending} {...form.register('email')} />
              {fieldError('email') ? <p role="alert" className="text-xs text-destructive">{fieldError('email')}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" autoComplete="current-password" invalid={!!fieldError('password')} disabled={login.isPending} {...form.register('password')} />
              {fieldError('password') ? <p role="alert" className="text-xs text-destructive">{fieldError('password')}</p> : null}
            </div>

            <LoadingButton type="submit" className="w-full" loading={login.isPending} loadingText="Signing in…">
              Sign in
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

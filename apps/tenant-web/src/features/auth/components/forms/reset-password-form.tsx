'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, TimerOff } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AUTH_ROUTES } from '../../constants';
import { toAuthError, useResetPassword } from '../../hooks/use-auth';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../../schemas';
import { AuthHeader } from '../auth-header';
import { FormAlert } from '../form-alert';
import { LoadingButton } from '../loading-button';
import { PasswordInput } from '../password-input';
import { PasswordStrengthMeter } from '../password-strength-meter';
import { StatusScreen } from '../status-screen';

export function ResetPasswordForm({ token }: { token: string }) {
  const resetPassword = useResetPassword();
  const [outcome, setOutcome] = React.useState<'idle' | 'success' | 'expired'>('idle');
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = form.watch('password');

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    resetPassword.mutate(
      { token, password: values.password },
      {
        onSuccess: () => setOutcome('success'),
        onError: (error) => {
          const authError = toAuthError(error);
          if (authError.code === 'TOKEN_EXPIRED' || authError.code === 'TOKEN_INVALID') {
            setOutcome('expired');
            return;
          }
          setServerError(authError.message);
        },
      },
    );
  });

  if (outcome === 'success') {
    return (
      <StatusScreen
        icon={CheckCircle2}
        tone="success"
        title="Password updated"
        description="Your password has been changed and all other sessions were signed out. You can now sign in with your new password."
      >
        <Button asChild className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Continue to login</Link>
        </Button>
      </StatusScreen>
    );
  }

  if (outcome === 'expired') {
    return (
      <StatusScreen
        icon={TimerOff}
        tone="warning"
        title="This link has expired"
        description="Reset links are valid for 30 minutes and can only be used once. Request a fresh link to continue."
      >
        <Button asChild className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.forgotPassword}>Request a new link</Link>
        </Button>
      </StatusScreen>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader title="Set a new password" subtitle="Choose a strong password you haven't used before." />

      <Card>
        <CardContent className="space-y-4 p-6 sm:p-8">
          <FormAlert variant="error" message={serverError} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                invalid={!!form.formState.errors.password}
                disabled={resetPassword.isPending}
                {...form.register('password')}
              />
              <PasswordStrengthMeter password={passwordValue} />
              {form.formState.errors.password ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                invalid={!!form.formState.errors.confirmPassword}
                disabled={resetPassword.isPending}
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            <LoadingButton
              type="submit"
              className="w-full"
              loading={resetPassword.isPending}
              loadingText="Updating password…"
            >
              Update password
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

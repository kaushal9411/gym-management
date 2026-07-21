'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, MailX, UserCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/features/auth/components/loading-button';
import { PasswordInput } from '@/features/auth/components/password-input';
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { StatusScreen } from '@/features/auth/components/status-screen';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/features/auth/schemas';
import { toStaffError, useAcceptStaffActivation, useStaffActivation } from '../hooks/use-staff';

/** Staff activation: set your own password → account flips from PENDING_VERIFICATION to ACTIVE. */
export function StaffActivationView({ token }: { token: string }) {
  const activation = useStaffActivation(token);
  const acceptActivation = useAcceptStaffActivation();
  const [accepted, setAccepted] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const passwordValue = form.watch('password');

  if (activation.isPending) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8">
          <Skeleton className="mx-auto size-16 rounded-full" />
          <Skeleton className="mx-auto h-5 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <span className="sr-only" role="status">Loading activation link…</span>
        </CardContent>
      </Card>
    );
  }

  if (activation.isError) {
    const err = toStaffError(activation.error);
    return (
      <StatusScreen
        icon={MailX}
        tone="warning"
        title={err.code === 'TOKEN_EXPIRED' ? 'Activation link expired' : 'Invalid activation link'}
        description={
          err.code === 'TOKEN_EXPIRED'
            ? 'This activation link is no longer valid. Ask your manager to resend it.'
            : 'This activation link is not valid. Check the link from your email or ask your manager for a new one.'
        }
      >
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Go to login</Link>
        </Button>
      </StatusScreen>
    );
  }

  const invite = activation.data;

  if (accepted) {
    return (
      <StatusScreen
        icon={CheckCircle2}
        tone="success"
        title="Account activated!"
        description="Your password is set. Sign in with your email and new password."
      >
        <Button asChild className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Continue to login</Link>
        </Button>
      </StatusScreen>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    acceptActivation.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          setAccepted(true);
          toast.success('Account activated');
        },
        onError: (error) => setServerError(toStaffError(error).message),
      },
    );
  });

  const isSubmitting = acceptActivation.isPending;
  const fieldError = (name: keyof ResetPasswordFormValues) => form.formState.errors[name]?.message;

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-1 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserCheck className="size-7" aria-hidden />
        </div>
        <CardTitle>Activate your account</CardTitle>
        <CardDescription>
          Welcome, {invite.name}. Set a password for <span className="font-medium text-foreground">{invite.email}</span> to finish setting up your account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <FormAlert variant="error" message={serverError} />

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Create password</Label>
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

          <LoadingButton type="submit" className="w-full" loading={isSubmitting} loadingText="Activating your account…">
            Activate account
          </LoadingButton>
        </form>
      </CardContent>
    </Card>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AUTH_ROUTES } from '../../constants';
import { useForgotPassword } from '../../hooks/use-auth';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../../schemas';
import { maskEmail } from '../../utils/mask';
import { AuthHeader } from '../auth-header';
import { LoadingButton } from '../loading-button';
import { StatusScreen } from '../status-screen';

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    // Always resolves to success — the API never reveals whether an email exists.
    forgotPassword.mutate(values.email, { onSuccess: () => setSentTo(values.email) });
  });

  if (sentTo) {
    return (
      <StatusScreen
        icon={MailCheck}
        tone="success"
        title="Check your email"
        description={`If an account exists for ${maskEmail(sentTo)}, a password reset link is on its way. The link expires in 30 minutes.`}
        footnote="Didn't get it? Check spam, or try again in a minute."
      >
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>
            <ArrowLeft aria-hidden />
            Back to login
          </Link>
        </Button>
      </StatusScreen>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Forgot your password?"
        subtitle="Enter your email and we'll send you a reset link."
      />

      <Card>
        <CardContent className="space-y-4 p-6 sm:p-8">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                invalid={!!form.formState.errors.email}
                disabled={forgotPassword.isPending}
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <LoadingButton
              type="submit"
              className="w-full"
              loading={forgotPassword.isPending}
              loadingText="Sending link…"
            >
              Send reset link
            </LoadingButton>
          </form>

          <Button asChild variant="ghost" className="w-full">
            <Link href={AUTH_ROUTES.login}>
              <ArrowLeft aria-hidden />
              Back to login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

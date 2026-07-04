'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabelledDivider } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/store/hooks';
import { AUTH_ROUTES } from '../../constants';
import { useLogin, toAuthError } from '../../hooks/use-auth';
import { loginSchema, type LoginFormValues } from '../../schemas';
import { getRememberedEmail, setRememberedEmail } from '../../utils/remember-me';
import { AuthHeader } from '../auth-header';
import { FormAlert } from '../form-alert';
import { LoadingButton } from '../loading-button';
import { PasswordInput } from '../password-input';
import { SocialLoginButtons } from '../social-buttons';

/** Error codes that navigate to a dedicated status page instead of inline. */
const REDIRECT_ERRORS: Record<string, string> = {
  ACCOUNT_SUSPENDED: AUTH_ROUTES.accountSuspended,
  TENANT_SUSPENDED: AUTH_ROUTES.accountSuspended,
  SUBSCRIPTION_EXPIRED: AUTH_ROUTES.subscriptionExpired,
  TRIAL_EXPIRED: AUTH_ROUTES.trialExpired,
  MAINTENANCE: AUTH_ROUTES.maintenance,
};

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const authenticatedUser = useAppSelector((state) => state.auth.user);
  const [inlineError, setInlineError] = React.useState<{ locked: boolean; message: string } | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  // Prefill remembered email after mount (localStorage is client-only).
  React.useEffect(() => {
    const remembered = getRememberedEmail();
    if (remembered) {
      form.setValue('email', remembered);
      form.setValue('rememberMe', true);
    }
  }, [form]);

  const onSubmit = form.handleSubmit((values) => {
    setInlineError(null);
    login.mutate(values, {
      onSuccess: (result) => {
        setRememberedEmail(values.rememberMe ? values.email : null);
        if (result.kind === 'otp_required') {
          const route = result.flow === '2fa' ? AUTH_ROUTES.twoFactor : AUTH_ROUTES.verifyOtp;
          router.push(`${route}?email=${encodeURIComponent(result.email)}&flow=${result.flow}`);
          return;
        }
        toast.success(`Welcome back, ${result.user.name.split(' ')[0]}!`);
      },
      onError: (error) => {
        const authError = toAuthError(error);
        if (authError.code === 'EMAIL_NOT_VERIFIED') {
          router.push(`${AUTH_ROUTES.verifyEmail}?status=pending&email=${encodeURIComponent(values.email)}`);
          return;
        }
        const redirect = REDIRECT_ERRORS[authError.code];
        if (redirect) {
          router.push(redirect);
          return;
        }
        setInlineError({ locked: authError.code === 'ACCOUNT_LOCKED', message: authError.message });
      },
    });
  });

  // Post-login success panel (dashboard ships in a later phase).
  if (authenticatedUser) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success"
          >
            <CheckCircle2 className="size-8" aria-hidden />
          </motion.div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">You&apos;re signed in</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{authenticatedUser.email}</span>.
              The dashboard arrives in the next phase.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSubmitting = login.isPending;

  return (
    <div className="space-y-6">
      <AuthHeader title="Sign in to your account" showWelcome />

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <FormAlert
            variant={inlineError?.locked ? 'locked' : 'error'}
            title={inlineError?.locked ? 'Account temporarily locked' : undefined}
            message={inlineError?.message ?? null}
          />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                invalid={!!form.formState.errors.email}
                aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
                disabled={isSubmitting}
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p id="email-error" role="alert" className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href={AUTH_ROUTES.forgotPassword}
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                invalid={!!form.formState.errors.password}
                aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
                disabled={isSubmitting}
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p id="password-error" role="alert" className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <Controller
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="remember-me" className="cursor-pointer font-normal text-muted-foreground">
                    Remember me on this device
                  </Label>
                </div>
              )}
            />

            <LoadingButton type="submit" className="w-full" loading={isSubmitting} loadingText="Signing in…">
              Sign in
            </LoadingButton>
          </form>

          <LabelledDivider label="or continue with" />
          <SocialLoginButtons disabled={isSubmitting} />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Want FitCloud for your gym?{' '}
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href={AUTH_ROUTES.register}>Start a free trial</Link>
        </Button>
      </p>
    </div>
  );
}

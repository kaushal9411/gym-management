'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MailPlus, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { AUTH_ROUTES } from '../../constants';
import { useResendOtp } from '../../hooks/use-auth';
import { resendOtpSchema, type ResendOtpFormValues } from '../../schemas';
import { AuthPanel } from '../auth-panel';
import { IconField } from '../icon-field';
import { LoadingButton } from '@/components/ui/loading-button';

/** Standalone resend — for users who closed the OTP screen or lost the code. */
export function ResendOtpForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const resendOtp = useResendOtp();

  const form = useForm<ResendOtpFormValues>({
    resolver: zodResolver(resendOtpSchema),
    defaultValues: { email: initialEmail },
  });

  const onSubmit = form.handleSubmit((values) => {
    resendOtp.mutate(values.email, {
      onSuccess: () => {
        toast.success('A new code is on its way');
        router.push(`${AUTH_ROUTES.verifyOtp}?email=${encodeURIComponent(values.email)}&flow=login`);
      },
    });
  });

  return (
    <AuthPanel
      icon={MailPlus}
      title="Resend verification code"
      subtitle="Enter the email you were signing in with and we'll send a fresh code."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <IconField
            id="email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            invalid={!!form.formState.errors.email}
            disabled={resendOtp.isPending}
            aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p id="email-error" role="alert" className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <LoadingButton type="submit" size="lg" className="w-full" loading={resendOtp.isPending} loadingText="Sending…">
          <Send aria-hidden />
          Send new code
        </LoadingButton>
      </form>
    </AuthPanel>
  );
}

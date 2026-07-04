'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AUTH_ROUTES } from '../../constants';
import { useResendOtp } from '../../hooks/use-auth';
import { resendOtpSchema, type ResendOtpFormValues } from '../../schemas';
import { AuthHeader } from '../auth-header';
import { LoadingButton } from '../loading-button';

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
    <div className="space-y-6">
      <AuthHeader
        title="Resend verification code"
        subtitle="Enter the email you were signing in with and we'll send a fresh code."
      />

      <Card>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                invalid={!!form.formState.errors.email}
                disabled={resendOtp.isPending}
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <LoadingButton type="submit" className="w-full" loading={resendOtp.isPending} loadingText="Sending…">
              <Send aria-hidden />
              Send new code
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

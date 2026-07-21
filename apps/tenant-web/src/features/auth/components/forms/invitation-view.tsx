'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, MailX, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AUTH_ROUTES } from '../../constants';
import { toAuthError, useAcceptInvitation, useInvitation } from '../../hooks/use-auth';
import { acceptInvitationSchema, type AcceptInvitationFormValues } from '../../schemas';
import { FormAlert } from '../form-alert';
import { LoadingButton } from '../loading-button';
import { PasswordInput } from '../password-input';
import { PasswordStrengthMeter } from '../password-strength-meter';
import { StatusScreen } from '../status-screen';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  TRAINER: 'Trainer',
  RECEPTIONIST: 'Receptionist',
  MEMBER: 'Member',
};

/** Staff/member invitation acceptance: verify token → profile + password → login. */
export function InvitationView({ token }: { token: string }) {
  const router = useRouter();
  const tenant = useTenant();
  const invitation = useInvitation(token);
  const acceptInvitation = useAcceptInvitation();
  const [accepted, setAccepted] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<AcceptInvitationFormValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { name: '', phone: '', password: '', confirmPassword: '' },
  });
  const passwordValue = form.watch('password');

  if (invitation.isPending) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8">
          <Skeleton className="mx-auto size-16 rounded-full" />
          <Skeleton className="mx-auto h-5 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <span className="sr-only" role="status">Loading invitation…</span>
        </CardContent>
      </Card>
    );
  }

  if (invitation.isError) {
    const authError = toAuthError(invitation.error);
    return (
      <StatusScreen
        icon={MailX}
        tone="warning"
        title={authError.code === 'TOKEN_EXPIRED' ? 'Invitation expired' : 'Invalid invitation'}
        description={
          authError.code === 'TOKEN_EXPIRED'
            ? 'This invitation is no longer valid. Ask your gym owner to send a new one.'
            : 'This invitation link is not valid. Check the link from your email or request a new invite.'
        }
      >
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Go to login</Link>
        </Button>
      </StatusScreen>
    );
  }

  const invite = invitation.data;

  if (accepted) {
    return (
      <StatusScreen
        icon={CheckCircle2}
        tone="success"
        title={`Welcome to ${tenant.name}!`}
        description="Your account is ready. Sign in with your email and the password you just created."
      >
        <Button asChild className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Continue to login</Link>
        </Button>
      </StatusScreen>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    acceptInvitation.mutate(
      {
        token,
        name: values.name,
        phone: values.phone || undefined,
        password: values.password,
      },
      {
        onSuccess: () => {
          setAccepted(true);
          toast.success('Invitation accepted');
        },
        onError: (error) => setServerError(toAuthError(error).message),
      },
    );
  });

  const isSubmitting = acceptInvitation.isPending;
  const fieldError = (name: keyof AcceptInvitationFormValues) => form.formState.errors[name]?.message;

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-1 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserPlus className="size-7" aria-hidden />
        </div>
        <CardTitle>Join {tenant.name}</CardTitle>
        <CardDescription>
          {invite.invitedBy} invited you to join as{' '}
          <span className="font-medium text-foreground">{ROLE_LABELS[invite.role] ?? invite.role}</span>{' '}
          ({invite.inviteeEmail}).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <FormAlert variant="error" message={serverError} />

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Your full name"
              invalid={!!fieldError('name')}
              disabled={isSubmitting}
              {...form.register('name')}
            />
            {fieldError('name') ? (
              <p role="alert" className="text-xs text-destructive">{fieldError('name')}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              invalid={!!fieldError('phone')}
              disabled={isSubmitting}
              {...form.register('phone')}
            />
            {fieldError('phone') ? (
              <p role="alert" className="text-xs text-destructive">{fieldError('phone')}</p>
            ) : null}
          </div>

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

          <LoadingButton type="submit" className="w-full" loading={isSubmitting} loadingText="Setting up your account…">
            Accept invitation
          </LoadingButton>
        </form>
      </CardContent>
    </Card>
  );
}

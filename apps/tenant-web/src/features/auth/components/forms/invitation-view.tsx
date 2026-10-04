'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, MailX, Phone, User, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AUTH_ROUTES } from '../../constants';
import { toAuthError, useAcceptInvitation, useInvitation } from '../../hooks/use-auth';
import { acceptInvitationSchema, type AcceptInvitationFormValues } from '../../schemas';
import { AuthPanel, PanelSpinner } from '../auth-panel';
import { FormAlert } from '../form-alert';
import { IconField } from '../icon-field';
import { LoadingButton } from '@/components/ui/loading-button';
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
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <PanelSpinner label="Loading invitation…" />
      </div>
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
    <AuthPanel
      icon={UserPlus}
      title={`Join ${tenant.name}`}
      subtitle={
        <>
          {invite.invitedBy} invited you to join as{' '}
          <span className="font-medium text-foreground">{ROLE_LABELS[invite.role] ?? invite.role}</span>{' '}
          ({invite.inviteeEmail}).
        </>
      }
    >
      <FormAlert variant="error" message={serverError} />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <IconField
            id="name"
            icon={User}
            autoComplete="name"
            placeholder="Your full name"
            invalid={!!fieldError('name')}
            disabled={isSubmitting}
            aria-describedby={fieldError('name') ? 'name-error' : undefined}
            {...form.register('name')}
          />
          {fieldError('name') ? (
            <p id="name-error" role="alert" className="text-xs text-destructive">{fieldError('name')}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone <span className="text-muted-foreground">(optional)</span>
          </Label>
          <IconField
            id="phone"
            icon={Phone}
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            invalid={!!fieldError('phone')}
            disabled={isSubmitting}
            aria-describedby={fieldError('phone') ? 'phone-error' : undefined}
            {...form.register('phone')}
          />
          {fieldError('phone') ? (
            <p id="phone-error" role="alert" className="text-xs text-destructive">{fieldError('phone')}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Create password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className="h-12 text-[15px]"
            invalid={!!fieldError('password')}
            disabled={isSubmitting}
            aria-describedby={fieldError('password') ? 'password-error' : undefined}
            {...form.register('password')}
          />
          <PasswordStrengthMeter password={passwordValue} />
          {fieldError('password') ? (
            <p id="password-error" role="alert" className="text-xs text-destructive">{fieldError('password')}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            className="h-12 text-[15px]"
            invalid={!!fieldError('confirmPassword')}
            disabled={isSubmitting}
            aria-describedby={fieldError('confirmPassword') ? 'confirm-error' : undefined}
            {...form.register('confirmPassword')}
          />
          {fieldError('confirmPassword') ? (
            <p id="confirm-error" role="alert" className="text-xs text-destructive">{fieldError('confirmPassword')}</p>
          ) : null}
        </div>

        <LoadingButton type="submit" size="lg" className="w-full" loading={isSubmitting} loadingText="Setting up your account…">
          Accept invitation
        </LoadingButton>
      </form>
    </AuthPanel>
  );
}

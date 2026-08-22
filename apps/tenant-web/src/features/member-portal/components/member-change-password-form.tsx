'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { FormAlert } from '@/features/auth/components/form-alert';
import { LoadingButton } from '@/components/ui/loading-button';
import { PasswordInput } from '@/features/auth/components/password-input';
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/features/auth/schemas';
import { toMemberAuthServiceError } from '../services/member-api-client';
import { useChangeMemberPassword } from '../hooks/use-member-portal';

/**
 * In-app password change for the member portal — reuses the exact form
 * shape/fields the staff account settings page uses (`ChangePasswordForm`),
 * just against `POST /portal/change-password` instead of
 * `PATCH /auth/change-password`. Until this existed, a member had no way
 * to change their password while signed in at all — only the logged-out
 * "Forgot password" email-reset flow.
 */
export function MemberChangePasswordForm() {
  const changePassword = useChangeMemberPassword();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPasswordValue = form.watch('newPassword');

  const onSubmit = form.handleSubmit((values) => {
    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success('Password updated. Your other devices have been signed out.');
          form.reset();
        },
        onError: (error) => {
          form.setError('currentPassword', { message: toMemberAuthServiceError(error).message });
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert variant="error" message={form.formState.errors.currentPassword?.message ?? null} />

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          invalid={!!form.formState.errors.currentPassword}
          disabled={changePassword.isPending}
          {...form.register('currentPassword')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          invalid={!!form.formState.errors.newPassword}
          disabled={changePassword.isPending}
          {...form.register('newPassword')}
        />
        <PasswordStrengthMeter password={newPasswordValue} />
        {form.formState.errors.newPassword ? (
          <p role="alert" className="text-xs text-destructive">
            {form.formState.errors.newPassword.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          invalid={!!form.formState.errors.confirmPassword}
          disabled={changePassword.isPending}
          {...form.register('confirmPassword')}
        />
        {form.formState.errors.confirmPassword ? (
          <p role="alert" className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <LoadingButton type="submit" loading={changePassword.isPending} loadingText="Updating password…">
        Update password
      </LoadingButton>
    </form>
  );
}

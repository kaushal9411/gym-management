'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { toAuthError, useChangePassword } from '../../hooks/use-auth';
import { changePasswordSchema, type ChangePasswordFormValues } from '../../schemas';
import { FormAlert } from '../form-alert';
import { LoadingButton } from '../loading-button';
import { PasswordInput } from '../password-input';
import { PasswordStrengthMeter } from '../password-strength-meter';

/** In-app password change (authenticated) — distinct from the forgot-password email flow. */
export function ChangePasswordForm() {
  const changePassword = useChangePassword();

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
          toast.success('Password updated. Your other sessions have been signed out.');
          form.reset();
        },
        onError: (error) => {
          const authError = toAuthError(error);
          form.setError('currentPassword', { message: authError.message });
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

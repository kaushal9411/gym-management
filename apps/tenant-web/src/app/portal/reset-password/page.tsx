'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { memberAuthService } from '@/features/member-portal/services/member-auth.service';
import type { MemberAuthServiceError } from '@/features/member-portal/types';
import { MEMBER_PORTAL_ROUTES } from '@/features/member-portal/constants';

export default function MemberResetPasswordPage() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const lookup = useQuery({ queryKey: ['member-password-reset', token], queryFn: () => memberAuthService.lookupPasswordReset(token), enabled: !!token, retry: false });
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await memberAuthService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError((err as MemberAuthServiceError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {!token ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>This link is missing its token.</AlertDescription>
            </Alert>
          ) : lookup.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : lookup.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{(lookup.error as MemberAuthServiceError).message}</AlertDescription>
            </Alert>
          ) : done ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto size-10 text-success" />
              <p className="text-sm">Your password has been reset.</p>
              <Button className="w-full" onClick={() => router.push(MEMBER_PORTAL_ROUTES.login)}>
                Go to login
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">Hi {lookup.data?.memberName}, choose a new password.</p>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                {/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: the first field on a single-purpose reset screen. */}
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Saving…' : 'Reset password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

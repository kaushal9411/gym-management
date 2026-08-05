'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { memberAuthService } from '@/features/member-portal/services/member-auth.service';

export default function MemberForgotPasswordPage() {
  const [memberId, setMemberId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await memberAuthService.forgotPassword(memberId.trim());
    } finally {
      setSubmitting(false);
      setSent(true); // never reveal whether the member id exists — same as the backend's own response
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto size-10 text-success" />
              <p className="text-sm text-muted-foreground">If a portal account exists for that Member ID, a reset link has been sent to the email on file.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberId">Member ID</Label>
                {/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: the sole field on this single-purpose form. */}
                <Input id="memberId" placeholder="MEM-0001" value={memberId} onChange={(e) => setMemberId(e.target.value)} autoFocus required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

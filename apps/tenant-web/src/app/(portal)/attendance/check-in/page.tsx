'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toAttendanceError, useCheckIn, useCheckOut, useManualCheckIn, useManualCheckOut, useValidateQrCode } from '@/features/attendance/hooks/use-attendance';
import { MemberActionCard } from '@/features/attendance/components/member-action-card';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { QrScanner } from '@/features/attendance/components/qr-scanner';
import { extractQrToken } from '@/features/attendance/utils/qr-token';
import type { MemberListItem } from '@/features/members/types';

function QrCheckInPanel() {
  const validateQr = useValidateQrCode();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const handleDecoded = (raw: string) => {
    const token = extractQrToken(raw);
    if (!token) return;
    validateQr.mutate(token, { onError: (err) => toast.error(toAttendanceError(err).message) });
  };

  const result = validateQr.data;
  const busy = checkIn.isPending || checkOut.isPending;

  const handleAction = () => {
    if (!result?.member) return;
    if (result.alreadyCheckedIn) {
      checkOut.mutate(
        { memberId: result.member.id },
        {
          onSuccess: () => {
            toast.success('Checked out.');
            validateQr.reset();
          },
          onError: (err) => toast.error(toAttendanceError(err).message),
        },
      );
    } else {
      checkIn.mutate(
        { memberId: result.member.id, method: 'QR_CODE' },
        {
          onSuccess: () => {
            toast.success('Checked in.');
            validateQr.reset();
          },
          onError: (err) => toast.error(toAttendanceError(err).message),
        },
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scan QR code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <QrScanner onDecoded={handleDecoded} disabled={validateQr.isPending} />
        {result?.member ? (
          <MemberActionCard
            name={result.member.name}
            memberId={result.member.memberId}
            profilePhotoUrl={result.member.profilePhotoUrl}
            eligible={result.valid}
            reason={result.valid ? null : result.reason}
            actionLabel={result.alreadyCheckedIn ? 'Check out' : 'Check in'}
            onAction={handleAction}
            busy={busy}
          />
        ) : result && !result.member ? (
          <p className="text-sm text-destructive">{result.reason ?? 'QR code not recognized.'}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ManualCheckInPanel() {
  const [selected, setSelected] = React.useState<MemberListItem | null>(null);
  const manualCheckIn = useManualCheckIn();
  const manualCheckOut = useManualCheckOut();
  const busy = manualCheckIn.isPending || manualCheckOut.isPending;

  const activeMembership = selected?.currentMembership;
  const eligible = selected?.status === 'ACTIVE' && !!activeMembership && new Date(activeMembership.endDate) >= new Date();
  const reason =
    selected?.status === 'FROZEN'
      ? 'Member is frozen and cannot check in.'
      : selected?.status !== 'ACTIVE'
        ? 'Member is not active.'
        : !activeMembership
          ? 'Member has no active membership.'
          : new Date(activeMembership.endDate) < new Date()
            ? 'Membership has expired.'
            : null;

  const handleCheckIn = () => {
    if (!selected) return;
    manualCheckIn.mutate(
      { memberId: selected.id },
      {
        onSuccess: () => {
          toast.success('Checked in.');
          setSelected(null);
        },
        onError: (err) => toast.error(toAttendanceError(err).message),
      },
    );
  };

  const handleCheckOut = () => {
    if (!selected) return;
    manualCheckOut.mutate(
      { memberId: selected.id },
      {
        onSuccess: () => {
          toast.success('Checked out.');
          setSelected(null);
        },
        onError: (err) => toast.error(toAttendanceError(err).message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manual member search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MemberCheckinSearch onSelect={setSelected} />
        {selected ? (
          <div className="space-y-2">
            <MemberActionCard
              name={selected.name}
              memberId={selected.memberId}
              profilePhotoUrl={selected.profilePhotoUrl}
              eligible={eligible}
              reason={reason}
              actionLabel="Check in"
              onAction={handleCheckIn}
              busy={busy}
            />
            <p className="text-xs text-muted-foreground">
              Already inside?{' '}
              <button type="button" className="underline underline-offset-2 disabled:opacity-50" disabled={busy} onClick={handleCheckOut}>
                Check out instead
              </button>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AttendanceCheckInPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/attendance">
          <ArrowLeft className="size-4" /> Back to attendance
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check in / Check out</h1>
        <p className="text-muted-foreground">Scan a member&apos;s QR code, or search for them manually.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QrCheckInPanel />
        <ManualCheckInPanel />
      </div>
    </div>
  );
}

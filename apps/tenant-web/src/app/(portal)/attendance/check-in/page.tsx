'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ArrowLeft, QrCode, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { SectionLoader } from '@/components/ui/section-loader';
import { toAttendanceError, useCheckIn, useCheckOut, useManualCheckIn, useManualCheckOut, useTodayAttendance, useValidateQrCode } from '@/features/attendance/hooks/use-attendance';
import { ActivityFeedPanel } from '@/features/attendance/components/attendance-overview';
import { MemberActionCard } from '@/features/attendance/components/member-action-card';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import { extractQrToken } from '@/features/attendance/utils/qr-token';
import type { MemberListItem } from '@/features/members/types';

// Global Loading & Performance Optimization (Prompt 23) — the camera/QR
// decode loop has no business being in the initial bundle for the (far
// more common) manual check-in path on this same page; `ssr:false` since
// `getUserMedia` only exists in the browser anyway.
const QrScanner = dynamic(() => import('@/features/attendance/components/qr-scanner').then((m) => m.QrScanner), {
  ssr: false,
  loading: () => <SectionLoader label="Loading scanner…" />,
});

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
    <PanelCard icon={QrCode} accent="primary" title="Scan QR code" delay={0.05}>
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
    </PanelCard>
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
    <PanelCard icon={Search} accent="violet" title="Manual member search" delay={0.1}>
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
    </PanelCard>
  );
}

export default function AttendanceCheckInPage() {
  const today = useTodayAttendance();

  return (
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/attendance">
          <ArrowLeft className="size-4" /> Back to attendance
        </Link>
      </Button>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:px-7"
        style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Live</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Check in / Check out</h1>
          <p className="mt-1 text-white/85">Scan a member&apos;s QR code, or search for them manually.</p>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
        <QrCheckInPanel />
        <ManualCheckInPanel />
        <ActivityFeedPanel records={today.data} loading={today.isPending} />
      </div>
    </div>
  );
}

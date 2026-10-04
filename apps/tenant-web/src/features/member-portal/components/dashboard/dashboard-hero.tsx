'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarRange, CreditCard, QrCode } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { formatDate, initials, timeGreeting } from '../../lib/format';
import type { MemberOverview } from '../../services/member-portal.service';
import { HeroAction, HeroChip, heroActionClass, PortalHero } from '../kit/portal-hero';
import { ProgressRing } from '../kit/progress-ring';
import { SheetModal } from '../kit/sheet-modal';

/** Dashboard hero: greeting, plan + status chips, days-left ring, quick actions (Renew / Book class / My QR). */
export function DashboardHero({ overview, qrUrl }: { overview: MemberOverview; qrUrl: string | null }) {
  const [qrOpen, setQrOpen] = React.useState(false);
  const { member, membership, attendance } = overview;
  const first = member.name.split(' ')[0] ?? member.name;
  const urgent = !membership || membership.expired || membership.daysLeft <= 14;
  const ringPct = membership && membership.totalDays ? Math.max(0, Math.min(100, (membership.daysLeft / membership.totalDays) * 100)) : null;

  const aside = membership && ringPct !== null ? (
    <ProgressRing value={ringPct} size={84} thickness={8} onDark>
      <div className="leading-none">
        <p className="text-xl font-bold tabular-nums">{Math.max(membership.daysLeft, 0)}</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">days left</p>
      </div>
    </ProgressRing>
  ) : (
    <Avatar className="size-16 ring-2 ring-white/40">
      <AvatarImage src={member.photoUrl ?? undefined} alt={member.name} />
      <AvatarFallback className="bg-white/20 text-lg font-semibold text-white">{initials(member.name)}</AvatarFallback>
    </Avatar>
  );

  return (
    <>
      <PortalHero
        eyebrow={timeGreeting()}
        title={first}
        subtitle={
          membership
            ? membership.expired
              ? `${membership.planName} expired on ${formatDate(membership.endDate)}`
              : `${membership.planName} · valid until ${formatDate(membership.endDate)}`
            : 'No active membership yet'
        }
        chips={
          <>
            <HeroChip>{member.memberId}</HeroChip>
            {membership ? <HeroChip>{membership.expired ? 'Expired' : membership.status}</HeroChip> : null}
            {member.branch ? <HeroChip>{member.branch.name}</HeroChip> : null}
          </>
        }
        aside={aside}
        stats={[
          { label: 'Total visits', value: attendance.totalVisits },
          { label: 'Streak', value: attendance.currentStreakDays },
          { label: 'This month', value: attendance.thisMonth.visits },
        ]}
        actions={
          <>
            <Link href={MEMBER_PORTAL_ROUTES.renew} className={heroActionClass(urgent ? 'solid' : 'ghost')}>
              <CreditCard className="size-4" /> Renew
            </Link>
            <Link href={MEMBER_PORTAL_ROUTES.classes} className={heroActionClass('ghost')}>
              <CalendarRange className="size-4" /> Book class
            </Link>
            {qrUrl ? (
              <HeroAction onClick={() => setQrOpen(true)}>
                <QrCode className="size-4" /> My QR
              </HeroAction>
            ) : null}
          </>
        }
      />
      {qrUrl ? (
        <SheetModal open={qrOpen} onOpenChange={setQrOpen} title="Check-in QR code" description="Show this at the front desk to check in." className="max-w-sm">
          <div className="grid place-items-center rounded-2xl bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR is a data-URL/object-storage URL, same convention as the staff-side QR display. */}
            <img src={qrUrl} alt="Check-in QR code" className="size-56 max-w-full" />
          </div>
        </SheetModal>
      ) : null}
    </>
  );
}

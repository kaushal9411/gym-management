'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemberDetail } from '@/features/members/hooks/use-members';
import { MemberMeasurementsCard } from '@/features/measurements/components/member-measurements-card';

/**
 * A focused view of just one member's measurement history — deliberately
 * NOT the full Member Detail page (`/members/[id]`, which has profile,
 * membership, attendance, workout, diet, QR code, etc.). Reached from the
 * Body Measurements list's "View / edit" link; `MemberMeasurementsCard`
 * itself is unchanged (same component the full Member Detail page also
 * embeds), so record/edit/delete work identically here.
 */
export default function MemberMeasurementsPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = params.memberId;
  const member = useMemberDetail(memberId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/measurements" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Body Measurements
      </Link>

      {member.isPending ? (
        <Skeleton className="h-14 w-full rounded-xl" />
      ) : member.isError || !member.data ? (
        <p className="text-sm text-destructive">Couldn&apos;t load this member — try refreshing.</p>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            {member.data.profilePhotoUrl ? <AvatarImage src={member.data.profilePhotoUrl} alt="" /> : null}
            <AvatarFallback>
              {member.data.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{member.data.name}</h1>
            <p className="text-sm text-muted-foreground">
              {member.data.memberId || 'No member ID'} · {member.data.branch.name}
            </p>
          </div>
        </div>
      )}

      <MemberMeasurementsCard memberId={memberId} />
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemberDetail } from '@/features/members/hooks/use-members';
import { MeasurementTrendChart } from '@/features/measurements/components/measurement-trend-chart';
import { MemberMeasurementsCard } from '@/features/measurements/components/member-measurements-card';
import { MemberMeasurementsHero } from '@/features/measurements/components/member-measurements-hero';
import { useMemberMeasurements } from '@/features/measurements/hooks/use-measurements';

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
  // Same query key `MemberMeasurementsCard` below uses — React Query dedupes
  // this into the same network request, so the trend chart is zero-cost.
  const measurements = useMemberMeasurements(memberId);

  return (
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/measurements">
          <ArrowLeft className="size-4" /> Back to Body Measurements
        </Link>
      </Button>

      {member.isPending ? (
        <Skeleton className="h-44 w-full rounded-3xl" />
      ) : member.isError || !member.data ? (
        <p className="text-sm text-destructive">Couldn&apos;t load this member — try refreshing.</p>
      ) : (
        <MemberMeasurementsHero
          name={member.data.name}
          memberId={member.data.memberId}
          profilePhotoUrl={member.data.profilePhotoUrl}
          branchName={member.data.branch.name}
          trainerName={member.data.trainer?.name ?? null}
          latest={measurements.data?.[0] ?? null}
          entryCount={measurements.data?.length ?? 0}
        />
      )}

      <MeasurementTrendChart entries={measurements.data ?? []} loading={measurements.isPending} />

      <MemberMeasurementsCard memberId={memberId} />
    </div>
  );
}

'use client';

import { UserRound } from 'lucide-react';

import { EmptyBlock, SkeletonCard, SkeletonHero } from '../kit';
import { useMemberSelfProfile } from '../../hooks/use-member-portal';
import { LockedCard } from './locked-card';
import { ProfileForm } from './profile-form';
import { ProfileHero } from './profile-hero';
import { SecurityCard } from './security-card';

/** `/portal/profile`: hero (photo + completeness) -> editable cards (sticky save bar) -> gym-managed -> security. */
export function ProfilePageContent() {
  const { data: profile, isLoading, isError, refetch } = useMemberSelfProfile();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    );
  }
  if (isError || !profile) {
    return <EmptyBlock icon={UserRound} title="Could not load your profile" description="Check your connection and try again." action={<button type="button" onClick={() => void refetch()} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">Retry</button>} />;
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <ProfileHero profile={profile} />
      <ProfileForm profile={profile} footer={<><LockedCard profile={profile} /><SecurityCard /></>} />
    </div>
  );
}

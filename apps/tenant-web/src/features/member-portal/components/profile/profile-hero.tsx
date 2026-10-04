'use client';

import * as React from 'react';
import { Camera, QrCode } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { MemberSelfProfile } from '../../services/member-profile.service';
import { initials } from '../../lib/format';
import { HeroAction, HeroChip, PortalHero, ProgressRing, SheetModal } from '../kit';
import { completeness } from './profile-form-lib';
import { PhotoSheet } from './photo-sheet';

/** Hero: avatar + camera FAB (photo flow), identity chips, real-field completeness ring, QR button. */
export function ProfileHero({ profile }: { profile: MemberSelfProfile }) {
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const { pct, missing } = completeness(profile);
  const plan = profile.locked.membership;

  return (
    <>
      <PortalHero
        eyebrow="My profile"
        title={profile.name}
        subtitle={profile.email ?? profile.phone ?? undefined}
        chips={
          <>
            <HeroChip>{profile.memberId}</HeroChip>
            <HeroChip>{profile.locked.status}</HeroChip>
            {plan ? <HeroChip>{plan.planName}</HeroChip> : null}
          </>
        }
        aside={
          <div className="relative">
            <Avatar className="size-24 ring-2 ring-white/50 md:size-28">
              <AvatarImage src={profile.profilePhotoUrl ?? undefined} alt={profile.name} />
              <AvatarFallback className="bg-white/20 text-3xl font-semibold text-white">{initials(profile.name)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              aria-label={profile.profilePhotoUrl ? 'Change profile photo' : 'Add profile photo'}
              className="absolute -bottom-1 -right-1 grid size-11 place-items-center rounded-full bg-white text-[color:var(--primary)] shadow-lg ring-2 ring-[color:var(--primary)] transition active:scale-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
            >
              <Camera className="size-5" />
            </button>
          </div>
        }
        actions={
          <>
            <div className="flex min-w-0 flex-1 basis-full items-center gap-3 rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-white/15 sm:basis-auto">
              <ProgressRing value={pct} size={48} thickness={5} onDark>
                <span className="text-[11px] font-semibold tabular-nums">{pct}%</span>
              </ProgressRing>
              <p className="min-w-0 text-xs leading-snug text-white/85">
                <span className="block font-semibold text-white">{pct === 100 ? 'Profile complete' : 'Profile completeness'}</span>
                {pct === 100 ? 'Nice work!' : `Add your ${missing.slice(0, 2).join(' and ')}${missing.length > 2 ? ` +${missing.length - 2} more` : ''}`}
              </p>
            </div>
            {profile.qrCodeImageUrl ? (
              <HeroAction onClick={() => setQrOpen(true)}>
                <QrCode className="size-4" /> Check-in QR
              </HeroAction>
            ) : null}
          </>
        }
      />
      <PhotoSheet open={photoOpen} onOpenChange={setPhotoOpen} name={profile.name} photoUrl={profile.profilePhotoUrl} />
      {profile.qrCodeImageUrl ? (
        <SheetModal open={qrOpen} onOpenChange={setQrOpen} title="Check-in QR code" description="Show this at the front desk to check in." className="max-w-sm">
          <div className="grid place-items-center rounded-2xl bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR is a data-URL/object-storage URL, same convention as the staff-side QR display. */}
            <img src={profile.qrCodeImageUrl} alt="Check-in QR code" className="size-56 max-w-full" />
          </div>
        </SheetModal>
      ) : null}
    </>
  );
}

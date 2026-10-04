'use client';

import * as React from 'react';
import { Clock, Dumbbell, Facebook, Globe, Instagram, Landmark, Linkedin, Mail, MapPin, Navigation, Phone, Twitter, Youtube, type LucideIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useGymInfo } from '../../hooks/use-member-portal';
import { initials, formatTime } from '../../lib/format';
import type { MemberGymAddress, MemberGymHour } from '../../services/member-portal.service';
import { EmptyBlock, HeroChip, ListRow, PortalHero, PortalList, SectionCard, SkeletonCard, SkeletonHero, StatusChip } from '../kit';
import { toneColor, toneTint } from '../kit/tones';
import { useNow } from './use-now';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SOCIAL: Record<string, { icon: LucideIcon; label: string }> = {
  instagram: { icon: Instagram, label: 'Instagram' },
  facebook: { icon: Facebook, label: 'Facebook' },
  twitter: { icon: Twitter, label: 'X / Twitter' },
  x: { icon: Twitter, label: 'X' },
  youtube: { icon: Youtube, label: 'YouTube' },
  linkedin: { icon: Linkedin, label: 'LinkedIn' },
};

function addressLines(a: MemberGymAddress | null | undefined): string[] {
  if (!a) return [];
  const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(', ');
  return [a.line1, a.line2, cityLine, a.country].filter((x): x is string => Boolean(x));
}
const toMin = (hhmm: string | null) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const externalUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

function openState(hours: MemberGymHour[] | null, now: Date | null): { open: boolean; label: string } | null {
  if (!hours || !now) return null;
  const today = hours.find((h) => h.day.toLowerCase() === DAYS[now.getDay()]!.toLowerCase());
  if (!today) return null;
  const o = toMin(today.open);
  const c = toMin(today.close);
  if (today.closed || o === null || c === null) return { open: false, label: 'Closed today' };
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur >= o && cur < c) return { open: true, label: `Open now · closes ${formatTime(today.close)}` };
  return { open: false, label: cur < o ? `Closed · opens ${formatTime(today.open)}` : 'Closed for today' };
}

const extLink = { target: '_blank', rel: 'noopener noreferrer' } as const;

export function GymPageContent() {
  const q = useGymInfo();
  const now = useNow();

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={3} />
      </div>
    );
  }
  const gym = q.data;
  if (q.isError || !gym) {
    return (
      <div className="rounded-2xl border bg-card">
        <EmptyBlock icon={Landmark} title="Gym details unavailable" description="We couldn't load your gym's details right now. Please try again later." />
      </div>
    );
  }

  const branch = gym.branch;
  const hours = branch?.businessHours?.length ? branch.businessHours : gym.businessHours?.length ? gym.businessHours : null;
  const phone = branch?.phone ?? gym.phone;
  const email = branch?.email ?? gym.email;
  const lines = addressLines(branch?.address).length ? addressLines(branch?.address) : addressLines(gym.address);
  const social = Object.entries(gym.social ?? {}).filter(([, v]) => Boolean(v));
  const state = openState(hours, now);
  const hasAnything = Boolean(phone || email || gym.website || lines.length || hours || social.length);
  const todayName = now ? DAYS[now.getDay()]!.toLowerCase() : '';
  const mapsHref = lines.length ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lines.join(', '))}` : null;

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="My gym"
        title={gym.name}
        subtitle={branch ? `Your branch: ${branch.name}` : undefined}
        chips={
          state ? (
            <HeroChip>
              <span className={cn('size-2 rounded-full', state.open ? 'bg-emerald-300' : 'bg-white/50')} />
              {state.label}
            </HeroChip>
          ) : undefined
        }
        aside={
          <Avatar className="size-16 rounded-2xl ring-2 ring-white/40">
            <AvatarImage src={gym.logoUrl ?? undefined} alt={gym.name} className="object-contain" />
            <AvatarFallback className="rounded-2xl bg-white/20 text-lg font-semibold text-white">{initials(gym.name)}</AvatarFallback>
          </Avatar>
        }
      />

      {!hasAnything ? (
        <div className="rounded-2xl border bg-card">
          <EmptyBlock icon={Dumbbell} title="Your gym hasn't added details yet" description="Address, phone and opening hours will show up here once the gym adds them." />
        </div>
      ) : null}

      {phone || email || gym.website ? (
        <SectionCard title="Get in touch" subtitle="Tap to call, email or visit" icon={Phone} tone="success" flush>
          <PortalList>
            {phone ? <ListRow icon={Phone} tone="success" title={phone} subtitle="Call" href={`tel:${phone}`} /> : null}
            {email ? <ListRow icon={Mail} tone="info" title={email} subtitle="Email" href={`mailto:${email}`} /> : null}
            {gym.website ? (
              <li>
                <a href={externalUrl(gym.website)} {...extLink} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60 active:bg-accent">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: toneTint('violet', 15), color: toneColor('violet') }}><Globe className="size-[18px]" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{gym.website.replace(/^https?:\/\//i, '')}</span><span className="block text-xs text-muted-foreground">Website</span></span>
                </a>
              </li>
            ) : null}
          </PortalList>
        </SectionCard>
      ) : null}

      {lines.length ? (
        <SectionCard title="Address" subtitle={branch?.name} icon={MapPin} tone="orange">
          <address className="not-italic">
            {lines.map((l, i) => <p key={i} className={cn('text-sm', i === 0 && 'font-medium')}>{l}</p>)}
          </address>
          {mapsHref ? (
            <a href={mapsHref} {...extLink} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition active:scale-[0.97]">
              <Navigation className="size-4" /> Get directions
            </a>
          ) : null}
        </SectionCard>
      ) : null}

      {hours ? (
        <SectionCard title="Opening hours" subtitle={state?.label} icon={Clock} tone="info" flush>
          <PortalList>
            {DAYS.slice(1).concat(DAYS[0]!).map((d) => {
              const h = hours.find((x) => x.day.toLowerCase() === d.toLowerCase());
              if (!h) return null;
              const isToday = d.toLowerCase() === todayName;
              const closed = h.closed || !h.open || !h.close;
              return (
                <li key={d} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm" style={isToday ? { background: toneTint('primary', 10) } : undefined}>
                  <span className={cn('flex-1', isToday ? 'font-semibold text-primary' : 'text-muted-foreground')}>{d}{isToday ? ' · Today' : ''}</span>
                  {closed ? <StatusChip tone="muted">Closed</StatusChip> : <span className={cn('tabular-nums', isToday && 'font-semibold')}>{formatTime(h.open)} – {formatTime(h.close)}</span>}
                </li>
              );
            })}
          </PortalList>
        </SectionCard>
      ) : null}

      {social.length ? (
        <SectionCard title="Follow us" icon={Instagram} tone="violet" flush>
          <PortalList>
            {social.map(([k, url]) => {
              const meta = SOCIAL[k.toLowerCase()] ?? { icon: Globe, label: k.charAt(0).toUpperCase() + k.slice(1) };
              return (
                <li key={k}>
                  <a href={externalUrl(url)} {...extLink} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60 active:bg-accent">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: toneTint('violet', 15), color: toneColor('violet') }}><meta.icon className="size-[18px]" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{meta.label}</span><span className="block truncate text-xs text-muted-foreground">{url.replace(/^https?:\/\/(www\.)?/i, '')}</span></span>
                  </a>
                </li>
              );
            })}
          </PortalList>
        </SectionCard>
      ) : null}
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, BellRing, Lock, Mail, MessageCircle, MessageSquare, Smartphone, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../../hooks/use-member-portal';
import type { PrefChannel } from '../../services/member-notification-prefs.service';
import { EmptyBlock, ListRow, PortalHero, PortalList, SectionCard, SkeletonCard, SkeletonHero } from '../kit';

const ICON: Record<PrefChannel, LucideIcon> = { PUSH: Smartphone, EMAIL: Mail, SMS: MessageSquare, WHATSAPP: MessageCircle };

/** Member-plane copy for failures (memberApiClient flattens errors to a message + RATE_LIMITED code). */
function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string } | undefined;
  if (e?.code === 'RATE_LIMITED') return 'You have changed this a lot in a short time. Please wait a few minutes and try again.';
  if (e?.message && /network/i.test(e.message)) return 'No connection. Your change was not saved. Check your internet and try again.';
  return e?.message || 'Could not save your change. Please try again.';
}

function PrefSwitch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="grid h-11 w-14 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      <span className={cn('relative h-[26px] w-11 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-border')}>
        <span className={cn('absolute left-[3px] top-[3px] size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-[18px]')} />
      </span>
    </button>
  );
}

/** `/portal/notification-preferences`: promotional opt-out per channel (saved on tap) and the categories that can never be blocked. */
export function NotificationPreferencesContent() {
  const q = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [pending, setPending] = React.useState<PrefChannel | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const change = (channel: PrefChannel, receive: boolean) => {
    if (update.isPending) return;
    setPending(channel);
    setError(null);
    update.mutate([{ channel, promotionalOptOut: !receive }], {
      onSuccess: () => toast.success(receive ? 'You will get promotions on this channel.' : 'Promotions turned off for this channel.'),
      onError: (err) => {
        const msg = friendlyError(err);
        setError(msg);
        toast.error(msg);
      },
      onSettled: () => setPending(null),
    });
  };

  const back = (
    <Link href={MEMBER_PORTAL_ROUTES.profile} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> Back to profile
    </Link>
  );

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="space-y-3">
        {back}
        <EmptyBlock
          icon={BellRing}
          title="Could not load your preferences"
          description={friendlyError(q.error)}
          action={
            <button type="button" onClick={() => void q.refetch()} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const data = q.data;
  return (
    <div className="space-y-4 md:space-y-5">
      {back}
      <PortalHero eyebrow="Account" title="Notification preferences" subtitle="Choose which promotional messages you get, channel by channel." />

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/8 px-3.5 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <SectionCard title="Promotions and announcements" subtitle="Turn a channel off to stop offers and general news on it" icon={BellRing} tone="primary" flush>
        <PortalList>
          {data.channels.map((c) => {
            const Icon = ICON[c.channel];
            const receiving = !c.promotionalOptOut;
            return (
              <ListRow
                key={c.channel}
                icon={Icon}
                tone={receiving ? 'primary' : 'muted'}
                title={c.label}
                subtitle={receiving ? 'Getting promotions' : 'Promotions off'}
                hideChevron
                trailing={<PrefSwitch label={`${c.label} promotions`} checked={receiving} disabled={update.isPending} onChange={(v) => change(c.channel, v)} />}
                className={pending === c.channel ? 'opacity-70' : undefined}
              />
            );
          })}
        </PortalList>
      </SectionCard>

      <SectionCard title="Always delivered" subtitle="These can't be turned off" icon={Lock} tone="warning" flush>
        <PortalList>
          {data.nonBlockable.map((n) => (
            <ListRow key={n.key} icon={Lock} tone="muted" title={n.label} hideChevron />
          ))}
        </PortalList>
      </SectionCard>

      <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">{data.note}</p>
    </div>
  );
}

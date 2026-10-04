'use client';

import { motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, ChevronDown, Hourglass, MapPin, Pencil, Send, Trash2, UserRound } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';
import { AUDIENCE_META, STATUS_META, expiryRelative, fmtDateTime, fmtDay, relativeTo, tint, useNow } from '../lib/announcement-meta';
import type { TenantAnnouncement } from '../types';

export interface AnnouncementCardActions {
  canUpdate: boolean;
  canPublish: boolean;
  canDelete: boolean;
  publishing: boolean;
  onEdit: (a: TenantAnnouncement) => void;
  onSchedule: (a: TenantAnnouncement) => void;
  onPublish: (a: TenantAnnouncement) => void;
  onDelete: (a: TenantAnnouncement) => void;
}

const PREVIEW_CHARS = 180;
const plainLength = (html: string) => html.replace(/<[^>]*>/g, '').trim().length;

function TimelineChip({ icon: Icon, children, color }: { icon: typeof CalendarClock; children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: tint(color, 13), color: `color-mix(in oklch, ${color} 80%, var(--foreground))` }}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

export function AnnouncementCard({ announcement: a, actions }: { announcement: TenantAnnouncement; actions: AnnouncementCardActions }) {
  const m = useMotionSafe();
  const now = useNow();
  const [expanded, setExpanded] = React.useState(false);
  const status = STATUS_META[a.status];
  const audience = AUDIENCE_META[a.audience];
  const AudienceIcon = audience.icon;
  const pending = a.status === 'DRAFT' || a.status === 'SCHEDULED';
  const long = plainLength(a.body) > PREVIEW_CHARS;

  return (
    <motion.article
      layout={m.reduce ? false : 'position'}
      initial={m.reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={m.reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      whileHover={m.reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border bg-card text-card-foreground shadow-xs transition-shadow hover:shadow-md"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: status.color }} />
      <div className="flex flex-1 flex-col gap-3 p-4 pl-5 sm:p-5 sm:pl-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ backgroundColor: tint(status.color, 15), color: `color-mix(in oklch, ${status.color} 75%, var(--foreground))` }}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: status.color }} aria-hidden />
            {status.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: tint(audience.color, 13), color: `color-mix(in oklch, ${audience.color} 80%, var(--foreground))` }}>
            <AudienceIcon className="size-3" aria-hidden /> {audience.short}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <MapPin className="size-3" aria-hidden /> {a.branch?.name ?? 'All branches'}
          </span>
        </div>

        <h3 className="text-[17px] font-extrabold leading-snug">{a.title}</h3>

        <div>
          {/* Staff-authored rich text — same trust model as other internal-content HTML in this app (e.g. invoice email bodies). */}
          <div
            className={cn('prose prose-sm max-w-none text-sm text-foreground/90', !expanded && 'line-clamp-3')}
            dangerouslySetInnerHTML={{ __html: a.body }}
          />
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1.5 inline-flex items-center gap-1 rounded text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expanded ? 'Show less' : 'Read more'}
              <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {a.status === 'SCHEDULED' && a.publishAt ? (
            <TimelineChip icon={CalendarClock} color={STATUS_META.SCHEDULED.color}>
              Publishes {fmtDateTime(a.publishAt)} · {relativeTo(a.publishAt, now)}
            </TimelineChip>
          ) : null}
          {a.status === 'PUBLISHED' && a.publishedAt ? (
            <TimelineChip icon={CheckCircle2} color={STATUS_META.PUBLISHED.color}>
              Published {fmtDateTime(a.publishedAt)}
            </TimelineChip>
          ) : null}
          {a.expiresAt ? (
            <TimelineChip icon={Hourglass} color={a.status === 'EXPIRED' ? STATUS_META.EXPIRED.color : 'var(--chart-2)'}>
              {a.status === 'EXPIRED' ? `Expired ${fmtDay(a.expiresAt)}` : `Expires ${fmtDay(a.expiresAt)} · ${expiryRelative(a.expiresAt, now)}`}
            </TimelineChip>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound className="size-3.5" aria-hidden /> {a.createdBy.name}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {actions.canUpdate && pending ? (
              <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => actions.onEdit(a)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            ) : null}
            {actions.canPublish && pending ? (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => actions.onSchedule(a)}>
                  <CalendarClock className="size-3.5" /> Schedule
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" disabled={actions.publishing} onClick={() => actions.onPublish(a)}>
                  <Send className="size-3.5" /> Publish now
                </Button>
              </>
            ) : null}
            {actions.canDelete ? (
              <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-destructive" aria-label={`Delete ${a.title}`} onClick={() => actions.onDelete(a)}>
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

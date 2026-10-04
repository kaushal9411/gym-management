'use client';

/**
 * /notifications — banner, KPI tiles, Announcements | Notifications tabs. Both composers are inline panels (no dialogs) with a live
 * preview card; "Send now" asks inline first because a send is irreversible. Data: /admin/notifications(+/announcements) — same hooks as before.
 * Dropped: delivery/open stats and per-audience recipient counts (the API stores neither; a send only stamps sentAt), scheduling
 * picker (backend supports scheduledAt but the old UI never offered it — unchanged; scheduled rows still render a "Scheduled" state).
 */
import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, Mail, Megaphone, Plus, Send, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { fmtInt } from '@/features/dashboard/components/format';
import { useNow } from '@/features/dashboard/components/use-now';
import { Banner, ConfirmRow } from '@/features/payments/components/pay-kit';
import { ErrorNote, MixBar, relTime, statusLabel } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { toNotificationError, useAnnouncements, useCreateAnnouncement, useCreateNotification, useNotifications, useSendNotification, useSetAnnouncementActive } from '../hooks/use-notifications';
import type { AdminNotification, AnnouncementAudience, NotificationChannel } from '../types';

const AUDIENCES: Array<{ value: AnnouncementAudience; label: string; hint: string }> = [
  { value: 'ALL', label: 'All tenants', hint: 'Every non-deleted tenant' },
  { value: 'TRIAL', label: 'Trial', hint: 'Tenants on a trial' },
  { value: 'ACTIVE', label: 'Active', hint: 'Paying, active tenants' },
  { value: 'SPECIFIC', label: 'Specific', hint: 'Targeted tenants' },
];
const CHANNELS: Array<{ value: NotificationChannel; label: string; icon: typeof Mail }> = [
  { value: 'EMAIL', label: 'Email', icon: Mail }, { value: 'PUSH', label: 'Push', icon: Smartphone }, { value: 'IN_APP', label: 'In-app', icon: Bell },
];
const INPUT = 'w-full rounded-[9px] border border-input bg-card px-3 py-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring';
const audLabel = (a: string) => AUDIENCES.find((x) => x.value === a)?.label ?? statusLabel(a);

function AudiencePicker({ value, onChange }: { value: AnnouncementAudience; onChange: (v: AnnouncementAudience) => void }) {
  return (
    <div role="radiogroup" aria-label="Audience" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {AUDIENCES.map((a) => (
        <button key={a.value} type="button" role="radio" aria-checked={value === a.value} onClick={() => onChange(a.value)}
          className={cn('rounded-[10px] border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', value === a.value ? 'border-primary bg-primary/10' : 'hover:bg-muted')}>
          <span className={cn('block text-[13px] font-semibold', value === a.value && 'text-primary')}>{a.label}</span>
          <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
        </button>
      ))}
    </div>
  );
}

function Preview({ title, body, audience, channel }: { title: string; body: string; audience: AnnouncementAudience; channel?: NotificationChannel }) {
  return (
    <div aria-label="Preview" className="rounded-[12px] border bg-muted/30 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
      <div className="flex gap-3 rounded-[10px] border bg-card p-3 shadow-sm">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden><Megaphone className="size-4" /></span>
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{title || 'Your title appears here'}</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{body || 'Your message body appears here.'}</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">To {audLabel(audience)}{channel ? ` · ${statusLabel(channel)}` : ''} · from FitCloud</p>
        </div>
      </div>
    </div>
  );
}

function Composer({ kind, withChannel, busy, onSubmit, onCancel }: { kind: string; withChannel: boolean; busy: boolean; onSubmit: (v: { title: string; body: string; audience: AnnouncementAudience; channel: NotificationChannel }) => void; onCancel: () => void }) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [audience, setAudience] = React.useState<AnnouncementAudience>('ALL');
  const [channel, setChannel] = React.useState<NotificationChannel>('EMAIL');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block space-y-1 text-[13px] font-medium">Title<input className={INPUT} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block space-y-1 text-[13px] font-medium">Body<textarea className={INPUT} rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        {withChannel ? (
          <div role="radiogroup" aria-label="Channel" className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={channel === c.value} onClick={() => setChannel(c.value)}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', channel === c.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                <c.icon className="size-3.5" aria-hidden />{c.label}
              </button>
            ))}
          </div>
        ) : null}
        <AudiencePicker value={audience} onChange={setAudience} />
      </div>
      <div className="space-y-3">
        <Preview title={title} body={body} audience={audience} channel={withChannel ? channel : undefined} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={() => onSubmit({ title, body, audience, channel })} disabled={busy || !title.trim() || !body.trim()}>{busy ? 'Saving…' : kind}</Button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsTab() {
  const q = useAnnouncements();
  const create = useCreateAnnouncement();
  const setActive = useSetAnnouncementActive();
  const [open, setOpen] = React.useState(false);
  const now = useNow();
  if (q.isPending) return <Skeleton className="h-64 rounded-[14px]" />;
  if (q.isError) return <ErrorNote what="announcements" message={q.error?.message} onRetry={() => void q.refetch()} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">{!open ? <Button onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden />New announcement</Button> : null}</div>
      {open ? (
        <Panel title="New announcement" hint="shown as a persistent banner" right={<button type="button" aria-label="Close composer" onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden /></button>}>
          <Composer kind="Publish announcement" withChannel={false} busy={create.isPending} onCancel={() => setOpen(false)}
            onSubmit={({ title, body, audience }) => create.mutate({ title, body, audience }, { onSuccess: () => { toast.success('Announcement created'); setOpen(false); }, onError: (err) => toast.error(toNotificationError(err).message) })} />
        </Panel>
      ) : null}
      {q.data.length === 0 ? <EmptyNote>No announcements yet.</EmptyNote> : (
        <ul className="space-y-2">
          {q.data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{a.title}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{a.body}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Chip tone="slate">{audLabel(a.audience)}</Chip>Created {relTime(a.createdAt, now)}</p>
              </div>
              <button type="button" aria-pressed={a.isActive} aria-label={`${a.isActive ? 'Deactivate' : 'Activate'} announcement ${a.title}`} disabled={setActive.isPending}
                onClick={() => setActive.mutate({ id: a.id, isActive: !a.isActive }, { onError: (err) => toast.error(toNotificationError(err).message) })}
                className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', a.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
                {a.isActive ? 'Active' : 'Inactive'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationsTab() {
  const q = useNotifications();
  const create = useCreateNotification();
  const send = useSendNotification();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [chan, setChan] = React.useState<NotificationChannel | 'ALL'>('ALL');
  const now = useNow();
  if (q.isPending) return <Skeleton className="h-64 rounded-[14px]" />;
  if (q.isError) return <ErrorNote what="notifications" message={q.error?.message} onRetry={() => void q.refetch()} />;
  const rows = q.data.filter((n) => chan === 'ALL' || n.channel === chan);
  const state = (n: AdminNotification) => (n.sentAt ? { tone: 'green' as const, label: 'Sent' } : n.scheduledAt ? { tone: 'blue' as const, label: 'Scheduled' } : { tone: 'amber' as const, label: 'Draft' });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Channel filter" className="flex flex-wrap gap-1.5">
          {(['ALL', ...CHANNELS.map((c) => c.value)] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={chan === c} onClick={() => setChan(c)}
              className={cn('rounded-full border px-3 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', chan === c ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
              {c === 'ALL' ? 'All channels' : statusLabel(c)} <span className="ml-1 tabular-nums opacity-80">{c === 'ALL' ? q.data.length : q.data.filter((n) => n.channel === c).length}</span>
            </button>
          ))}
        </div>
        {!open ? <Button onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden />New notification</Button> : null}
      </div>
      {open ? (
        <Panel title="New notification" hint="saved as a draft — send when ready" right={<button type="button" aria-label="Close composer" onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden /></button>}>
          <Composer kind="Create notification" withChannel busy={create.isPending} onCancel={() => setOpen(false)}
            onSubmit={(v) => create.mutate(v, { onSuccess: () => { toast.success('Notification created — send it when ready'); setOpen(false); }, onError: (err) => toast.error(toNotificationError(err).message) })} />
        </Panel>
      ) : null}
      {rows.length === 0 ? <EmptyNote>{q.data.length === 0 ? 'No notifications yet.' : 'No notifications on this channel.'}</EmptyNote> : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const s = state(n);
            const Icon = CHANNELS.find((c) => c.value === n.channel)?.icon ?? Bell;
            return (
              <li key={n.id} className="rounded-[14px] border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden><Icon className="size-4" /></span>
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{n.title}</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{n.body}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Chip tone="slate">{statusLabel(n.channel)}</Chip><Chip tone="slate">{audLabel(n.audience)}</Chip>{n.sentAt ? `Sent ${relTime(n.sentAt, now)}` : `Created ${relTime(n.createdAt, now)}`}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip tone={s.tone}>{s.label}</Chip>
                    {!n.sentAt ? <Button size="sm" onClick={() => setConfirm(n.id)} disabled={confirm === n.id}><Send className="size-3.5" aria-hidden />Send now</Button> : null}
                  </div>
                </div>
                {confirm === n.id ? (
                  <div className="mt-3">
                    <ConfirmRow text={`Send "${n.title}" to ${audLabel(n.audience)} tenants via ${statusLabel(n.channel)} now? This cannot be undone.`} confirmLabel="Send now" busy={send.isPending} onCancel={() => setConfirm(null)}
                      onConfirm={() => send.mutate(n.id, { onSuccess: () => { setConfirm(null); toast.success('Notification sent'); }, onError: (err) => toast.error(toNotificationError(err).message) })} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const reduce = useReducedMotion();
  const [tab, setTab] = React.useState<'announcements' | 'notifications'>('announcements');
  const ann = useAnnouncements();
  const notes = useNotifications();
  const a = ann.data ?? [];
  const n = notes.data ?? [];
  const sent = n.filter((x) => x.sentAt).length;
  const tabCls = (on: boolean) => cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground');
  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <Banner>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Bell className="size-6" aria-hidden />Notifications</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">Global announcements (persistent banner) and one-time broadcasts to tenants</p>
      </Banner>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard index={0} label="Active announcements" value={a.filter((x) => x.isActive).length} format={fmtInt} color="var(--chart-1)" fallbackCaption={`of ${fmtInt(a.length)} total`} />
        <KpiCard index={1} label="Notifications sent" value={sent} format={fmtInt} color="var(--chart-6)" fallbackCaption={`of ${fmtInt(n.length)} created`} />
        <KpiCard index={2} label="Drafts waiting" value={n.filter((x) => !x.sentAt && !x.scheduledAt).length} format={fmtInt} color="var(--chart-4)" fallbackCaption="not yet sent" />
        <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: reduce ? 0 : 0.09 }} className="min-w-0 rounded-[14px] border bg-card px-4 py-3.5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Notifications by channel</p>
          {n.length === 0 ? <p className="text-sm text-muted-foreground">No data yet</p> : <MixBar label="Channel mix" items={CHANNELS.map((c, i) => ({ label: c.label, value: n.filter((x) => x.channel === c.value).length, color: `var(--chart-${[1, 2, 3][i]})` }))} />}
        </motion.div>
      </div>
      <div className="flex flex-wrap items-center gap-x-1 border-b" role="tablist" aria-label="Notification type">
        {(['announcements', 'notifications'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} aria-controls="notif-panel" id={`tab-${t}`} className={tabCls(tab === t)} onClick={() => setTab(t)}>
            {statusLabel(t)}<b className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-foreground/80">{t === 'announcements' ? a.length : n.length}</b>
          </button>
        ))}
      </div>
      <div id="notif-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
            {tab === 'announcements' ? <AnnouncementsTab /> : <NotificationsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

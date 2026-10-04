'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Chip } from '@/features/finance/components/payments/payments-ui';
import { toAnnouncementError, useScheduleAnnouncement } from '../hooks/use-announcements';
import { COMM_HERO_GRADIENT, relativeTo } from '../lib/announcement-meta';
import type { TenantAnnouncement } from '../types';

type Preset = 'hour' | 'tomorrow' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');
/** `datetime-local` value in local time. */
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function presetValue(p: Exclude<Preset, 'custom'>): string {
  const d = new Date();
  if (p === 'hour') d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0);
  else {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return toLocalInput(d);
}

interface ScheduleAnnouncementDialogProps {
  announcement: TenantAnnouncement | null;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleAnnouncementDialog({ announcement, onOpenChange }: ScheduleAnnouncementDialogProps) {
  const schedule = useScheduleAnnouncement();
  const [publishAt, setPublishAt] = React.useState('');
  const [preset, setPreset] = React.useState<Preset>('custom');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPublishAt('');
    setPreset('custom');
    setError(null);
  }, [announcement]);

  const pick = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setPublishAt(presetValue(p));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!announcement) return;
    if (!publishAt || new Date(publishAt).getTime() <= Date.now()) {
      setError('Pick a future date and time.');
      return;
    }
    schedule.mutate(
      { id: announcement.id, input: { publishAt: new Date(publishAt).toISOString() } },
      {
        onSuccess: () => { toast.success('Announcement scheduled.'); onOpenChange(false); },
        onError: (err) => setError(toAnnouncementError(err).message),
      },
    );
  };

  const valid = publishAt !== '' && new Date(publishAt).getTime() > Date.now();

  return (
    <Dialog open={announcement !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        <div className="px-6 py-[22px] text-white" style={{ backgroundImage: COMM_HERO_GRADIENT }}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">Schedule announcement</p>
          <DialogTitle className="mt-1 break-words pr-10 text-[20px] font-extrabold leading-tight">&quot;{announcement?.title}&quot;</DialogTitle>
          <DialogDescription className="sr-only">Choose when this announcement is published.</DialogDescription>
        </div>
        <form onSubmit={submit}>
          <div className="space-y-4 px-6 py-6">
            {error ? (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Chip active={preset === 'hour'} onClick={() => pick('hour')}>In 1 hour</Chip>
              <Chip active={preset === 'tomorrow'} onClick={() => pick('tomorrow')}>Tomorrow 9am</Chip>
              <Chip active={preset === 'custom'} onClick={() => pick('custom')}>Custom</Chip>
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcementPublishAt" required>
                Publish at
              </Label>
              <Input
                id="announcementPublishAt"
                type="datetime-local"
                value={publishAt}
                onChange={(e) => {
                  setPublishAt(e.target.value);
                  setPreset('custom');
                }}
              />
            </div>
            {valid ? (
              <p className="rounded-[14px] bg-primary/10 px-4 py-3 text-[13px] font-semibold text-primary">
                Goes out {new Date(publishAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · <b>{relativeTo(new Date(publishAt).toISOString(), Date.now())}</b>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2.5 border-t px-6 py-[18px]">
            <Button type="button" variant="outline" className="h-11 rounded-xl px-5 font-bold" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" className="h-11 rounded-xl px-5 font-bold" loading={schedule.isPending} loadingText="Scheduling…">
              Schedule
            </LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

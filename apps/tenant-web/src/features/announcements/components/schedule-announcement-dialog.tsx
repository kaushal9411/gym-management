'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toAnnouncementError, useScheduleAnnouncement } from '../hooks/use-announcements';
import type { TenantAnnouncement } from '../types';

interface ScheduleAnnouncementDialogProps {
  announcement: TenantAnnouncement | null;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleAnnouncementDialog({ announcement, onOpenChange }: ScheduleAnnouncementDialogProps) {
  const schedule = useScheduleAnnouncement();
  const [publishAt, setPublishAt] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPublishAt('');
    setError(null);
  }, [announcement]);

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

  return (
    <Dialog open={announcement !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule &quot;{announcement?.title}&quot;</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="announcementPublishAt" required>
              Publish at
            </Label>
            <Input id="announcementPublishAt" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={schedule.isPending}>
            {schedule.isPending ? 'Scheduling…' : 'Schedule'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

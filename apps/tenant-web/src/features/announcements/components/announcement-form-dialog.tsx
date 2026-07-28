'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchSelect } from '@/features/members/components/branch-select';
import { cn } from '@/lib/utils';
import { toAnnouncementError, useCreateAnnouncement, useUpdateAnnouncement } from '../hooks/use-announcements';
import type { AnnouncementAudience, TenantAnnouncement } from '../types';
import { RichTextEditor } from './rich-text-editor';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface AnnouncementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing a DRAFT/SCHEDULED announcement; absent for Create. */
  editing?: TenantAnnouncement | null;
}

export function AnnouncementFormDialog({ open, onOpenChange, editing }: AnnouncementFormDialogProps) {
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();

  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [audience, setAudience] = React.useState<AnnouncementAudience>('ALL');
  const [branchId, setBranchId] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setBody(editing?.body ?? '');
    setAudience(editing?.audience ?? 'ALL');
    setBranchId(editing?.branch?.id ?? '');
    setExpiresAt(editing?.expiresAt?.slice(0, 10) ?? '');
    setError(null);
  }, [open, editing]);

  const isPending = createAnnouncement.isPending || updateAnnouncement.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim() || body === '<br>') {
      setError('Title and body are required.');
      return;
    }
    const input = { title: title.trim(), body, audience, branchId: branchId || undefined, expiresAt: expiresAt || undefined };

    if (editing) {
      updateAnnouncement.mutate(
        { id: editing.id, input },
        { onSuccess: () => { toast.success('Announcement updated.'); onOpenChange(false); }, onError: (err) => setError(toAnnouncementError(err).message) },
      );
    } else {
      createAnnouncement.mutate(input, {
        onSuccess: () => { toast.success('Announcement drafted.'); onOpenChange(false); },
        onError: (err) => setError(toAnnouncementError(err).message),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit announcement' : 'New announcement'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="announcementTitle" required>
              Title
            </Label>
            <Input id="announcementTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pool closed for maintenance" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcementBody" required>
              Body
            </Label>
            <RichTextEditor value={body} onChange={setBody} placeholder="Write your announcement..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcementAudience">Audience</Label>
              <select
                id="announcementAudience"
                className={selectClassName}
                value={audience}
                onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
              >
                <option value="ALL">Everyone</option>
                <option value="MEMBERS">Members only</option>
                <option value="STAFF">Staff only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcementBranch">Branch (optional)</Label>
              <BranchSelect id="announcementBranch" value={branchId} onChange={setBranchId} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcementExpiresAt">Expires on (optional)</Label>
            <Input id="announcementExpiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Saving…' : editing ? 'Save changes' : 'Save as draft'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

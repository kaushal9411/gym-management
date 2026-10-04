'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { BranchSelect } from '@/features/members/components/branch-select';
import { cn } from '@/lib/utils';
import { AUDIENCE_META, COMM_HERO_GRADIENT, tint } from '../lib/announcement-meta';
import { toAnnouncementError, useCreateAnnouncement, useUpdateAnnouncement } from '../hooks/use-announcements';
import type { AnnouncementAudience, TenantAnnouncement } from '../types';
import { RichTextEditor } from './rich-text-editor';

const AUDIENCES: AnnouncementAudience[] = ['ALL', 'MEMBERS', 'STAFF'];

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

  const isBlank = !body.trim() || body === '<br>';
  const AudienceIcon = AUDIENCE_META[audience].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        <div className="px-6 py-[22px] text-white" style={{ backgroundImage: COMM_HERO_GRADIENT }}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">Announcement</p>
          <DialogTitle className="mt-1 pr-10 text-[22px] font-extrabold">{editing ? 'Edit announcement' : 'New announcement'}</DialogTitle>
          <DialogDescription className="sr-only">Write the announcement, choose who sees it and optionally when it expires.</DialogDescription>
        </div>
        <form onSubmit={submit}>
          <div className="grid gap-6 px-6 py-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              {error ? (
                <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm font-semibold text-destructive">
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
              <div className="space-y-2">
                <Label>Audience</Label>
                <div role="radiogroup" aria-label="Audience" className="grid gap-2 sm:grid-cols-3">
                  {AUDIENCES.map((value) => {
                    const meta = AUDIENCE_META[value];
                    const active = audience === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setAudience(value)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-[14px] border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active ? 'border-transparent' : 'border-input hover:bg-accent',
                        )}
                        style={active ? { backgroundColor: tint(meta.color, 12), boxShadow: `inset 0 0 0 2px ${meta.color}` } : undefined}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tint(meta.color, 16), color: meta.color }}>
                          <meta.icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{meta.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{meta.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="announcementBranch">Branch (optional)</Label>
                  <BranchSelect id="announcementBranch" value={branchId} onChange={setBranchId} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcementExpiresAt">Expires on (optional)</Label>
                  <Input id="announcementExpiresAt" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Live preview — display only; renders the editor's own HTML with the same trusted-HTML model as the list. */}
            <aside className="min-w-0 md:sticky md:top-0 md:self-start" aria-label="Live preview">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Live preview</p>
              <div className="relative overflow-hidden rounded-[20px] border bg-card shadow-xs">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: 'var(--muted-foreground)' }} />
                <div className="space-y-2.5 p-4 pl-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-extrabold text-muted-foreground">Draft</span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: tint(AUDIENCE_META[audience].color, 13), color: AUDIENCE_META[audience].color }}>
                      <AudienceIcon className="size-3" aria-hidden /> {AUDIENCE_META[audience].short}
                    </span>
                  </div>
                  <h3 className={cn('text-[17px] font-extrabold leading-snug break-words', !title.trim() && 'text-muted-foreground/60')}>{title.trim() || 'Your title appears here'}</h3>
                  {isBlank ? (
                    <p className="text-sm text-muted-foreground/60">Your message appears here.</p>
                  ) : (
                    <div className="prose prose-sm max-h-64 max-w-none overflow-y-auto break-words text-sm" dangerouslySetInnerHTML={{ __html: body }} />
                  )}
                  {expiresAt ? <p className="text-xs font-semibold text-muted-foreground">Expires {new Date(`${expiresAt}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p> : null}
                </div>
              </div>
            </aside>
          </div>
          <div className="flex flex-wrap justify-end gap-2.5 border-t px-6 py-[18px]">
            <Button type="button" variant="outline" className="h-11 rounded-xl px-5 font-bold" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" className="h-11 rounded-xl px-5 font-bold" loading={isPending} loadingText="Saving…">
              {editing ? 'Save changes' : 'Save as draft'}
            </LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toTenantError } from '@/features/tenants/hooks/use-tenants';
import { useAddNote, useDeleteNote, useSaveTags, useTenantNotes, useTenantTags } from '@/features/tenants/api/detail';
import { Chip } from '@/features/dashboard/components/ui';
import { READONLY_TIP } from './confirm';

const TAG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Admin-only tags (chips editor → PUT /tags) and internal notes (never visible to the tenant). */
export function NotesTags({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const tagsQ = useTenantTags(tenantId);
  const notesQ = useTenantNotes(tenantId);
  const saveTags = useSaveTags(tenantId);
  const addNote = useAddNote(tenantId);
  const delNote = useDeleteNote(tenantId);
  const [tagDraft, setTagDraft] = useState('');
  const [tagErr, setTagErr] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const tags = tagsQ.data?.tags ?? [];
  const persist = async (next: string[], msg: string) => {
    try { await saveTags.mutateAsync(next); toast.success(msg); } catch (e) { toast.error(toTenantError(e).message); }
  };
  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t) return;
    if (!TAG_RE.test(t) || t.length > 24) { setTagErr('Letters, digits and dashes, max 24 chars.'); return; }
    if (tags.includes(t)) { setTagErr('Tag already added.'); return; }
    if (tags.length >= 10) { setTagErr('At most 10 tags.'); return; }
    setTagErr(null); setTagDraft('');
    void persist([...tags, t], `Tag “${t}” added`);
  };
  const submitNote = async () => {
    const b = body.trim();
    if (!b) return;
    try { await addNote.mutateAsync(b); setBody(''); toast.success('Note added'); } catch (e) { toast.error(toTenantError(e).message); }
  };
  const removeNote = async (id: string) => {
    try { await delNote.mutateAsync(id); setConfirmDel(null); toast.success('Note deleted'); } catch (e) { toast.error(toTenantError(e).message); }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Tags">
          {tagsQ.isLoading ? <span className="h-5 w-24 animate-pulse rounded-full bg-muted" /> : null}
          {tags.map((t) => (
            <Chip key={t} tone="blue" className="gap-1 pr-1">
              {t}
              {canManage ? <button type="button" aria-label={`Remove tag ${t}`} disabled={saveTags.isPending} onClick={() => void persist(tags.filter((x) => x !== t), `Tag “${t}” removed`)} className="rounded-full p-0.5 outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3" aria-hidden /></button> : null}
            </Chip>
          ))}
          {!tagsQ.isLoading && tags.length === 0 ? <span className="text-xs text-muted-foreground">No tags yet.</span> : null}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addTag(); }}>
          <Input value={tagDraft} onChange={(e) => { setTagDraft(e.target.value); setTagErr(null); }} placeholder="Add tag (e.g. key-account)" aria-label="New tag" maxLength={24} disabled={!canManage} title={canManage ? undefined : READONLY_TIP} className="h-8 text-xs" />
          <Button type="submit" size="sm" variant="outline" disabled={!canManage || saveTags.isPending || !tagDraft.trim()}><Plus className="size-4" aria-hidden />Add</Button>
        </form>
        {tagErr ? <p role="alert" className="mt-1 text-xs text-destructive">{tagErr}</p> : null}
      </div>

      <div className="space-y-2 border-t pt-3">
        <label htmlFor={`note-${tenantId}`} className="sr-only">Internal note</label>
        <textarea id={`note-${tenantId}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} disabled={!canManage} title={canManage ? undefined : READONLY_TIP} placeholder="Add a private note for the team…" className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" />
        <Button type="button" size="sm" disabled={!canManage || !body.trim() || addNote.isPending} onClick={() => void submitNote()}>
          {addNote.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Add note
        </Button>
        <ul className="space-y-2" aria-label="Internal notes">
          {notesQ.isLoading ? <li className="h-14 animate-pulse rounded-lg bg-muted" /> : null}
          {notesQ.data?.length === 0 ? <li className="text-xs text-muted-foreground">No notes yet.</li> : null}
          {notesQ.data?.map((n) => (
            <li key={n.id} className="rounded-lg border bg-muted/40 px-3 py-2 text-[13px]">
              <p className="whitespace-pre-wrap break-words">{n.body}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</span>
                {n.canDelete && canManage ? (
                  confirmDel === n.id ? (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span>Delete this note?</span>
                      <Button type="button" size="sm" variant="destructive" className="h-6 px-2 text-[11px]" disabled={delNote.isPending} onClick={() => void removeNote(n.id)}>Delete</Button>
                      <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setConfirmDel(null)}>Keep</Button>
                    </span>
                  ) : (
                    <button type="button" aria-label="Delete note" onClick={() => setConfirmDel(n.id)} className="ml-auto rounded p-1 outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="size-3.5" aria-hidden /></button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { toCmsError, useCmsPages, useCreateCmsPage, useDeleteCmsPage, useUpdateCmsPage } from '@/features/cms/hooks/use-cms';
import type { CmsPage, CmsPageType } from '@/features/cms/types';

const PAGE_TYPES: CmsPageType[] = ['LANDING', 'BLOG', 'FAQ', 'TESTIMONIAL', 'TERMS', 'PRIVACY', 'COOKIE'];

interface FormState {
  slug: string;
  type: CmsPageType;
  title: string;
  contentText: string;
  isPublished: boolean;
}

const EMPTY_FORM: FormState = { slug: '', type: 'BLOG', title: '', contentText: '{\n  "body": ""\n}', isPublished: false };

export default function CmsPage() {
  const { data: pages, isLoading } = useCmsPages();
  const createPage = useCreateCmsPage();
  const updatePage = useUpdateCmsPage();
  const deletePage = useDeleteCmsPage();

  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<CmsPage | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const openEdit = (page: CmsPage) => {
    setForm({ slug: page.slug, type: page.type, title: page.title, contentText: JSON.stringify(page.content, null, 2), isPublished: page.isPublished });
    setEditing(page);
  };

  const submit = () => {
    let content: unknown;
    try {
      content = JSON.parse(form.contentText);
      setJsonError(null);
    } catch {
      setJsonError('Content must be valid JSON.');
      return;
    }

    if (creating) {
      createPage.mutate(
        { slug: form.slug, type: form.type, title: form.title, content, isPublished: form.isPublished },
        { onSuccess: () => { toast.success('Page created'); setCreating(false); }, onError: (err) => toast.error(toCmsError(err).message) },
      );
    } else if (editing) {
      updatePage.mutate(
        { slug: editing.slug, input: { type: form.type, title: form.title, content, isPublished: form.isPublished } },
        { onSuccess: () => { toast.success('Page updated'); setEditing(null); }, onError: (err) => toast.error(toCmsError(err).message) },
      );
    }
  };

  const columns: DataTableColumn<CmsPage>[] = [
    { key: 'title', header: 'Title', render: (p) => <span className="font-medium">{p.title}</span> },
    { key: 'slug', header: 'Slug', render: (p) => p.slug },
    { key: 'type', header: 'Type', render: (p) => p.type },
    { key: 'status', header: 'Status', render: (p) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isPublished ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{p.isPublished ? 'Published' : 'Draft'}</span> },
    { key: 'updatedAt', header: 'Updated', render: (p) => new Date(p.updatedAt).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
          <Button size="sm" variant="destructive" onClick={() => { if (window.confirm(`Delete ${p.title}?`)) deletePage.mutate(p.slug, { onError: (err) => toast.error(toCmsError(err).message) }); }}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CMS</h1>
          <p className="text-muted-foreground">Landing page content, blogs, FAQs, testimonials, and legal pages.</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setCreating(true); }}>Create page</Button>
      </div>

      {isLoading || !pages ? <Skeleton className="h-72 rounded-xl" /> : <DataTable columns={columns} rows={pages} rowKey={(p) => p.id} />}

      <Dialog open={creating || !!editing} onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{creating ? 'Create page' : `Edit ${editing?.title}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} disabled={!creating} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Type</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CmsPageType })}>
                  {PAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Content (JSON)</Label>
              <textarea
                className="h-40 w-full rounded-md border border-input bg-background p-2 font-mono text-xs shadow-sm"
                value={form.contentText}
                onChange={(e) => setForm({ ...form, contentText: e.target.value })}
              />
              {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              Published
            </label>
            <Button className="w-full" onClick={submit} disabled={createPage.isPending || updatePage.isPending}>{creating ? 'Create page' : 'Save changes'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

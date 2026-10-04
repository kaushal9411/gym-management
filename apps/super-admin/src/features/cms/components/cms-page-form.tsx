'use client';

/**
 * CMS editor: two columns (details + editor | live preview). The preview renders the current HTML in a fully
 * sandboxed iframe (no scripts, no same-origin) so admin-authored markup can never execute in the portal.
 * Logic (create/update/delete hooks, starter content, slug rules) is unchanged; window.confirm -> inline confirm row.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Panel } from '@/features/dashboard/components/ui';
import { ConfirmRow } from '@/features/payments/components/pay-kit';
import { FIELD, Field, SaveBar } from '@/features/shell/components/page-kit';
import { contentKeyFor, DEFAULT_CONTENT, PAGE_TYPE_META, PAGE_TYPES, slugify } from '../constants';
import { toCmsError, useCreateCmsPage, useDeleteCmsPage, useUpdateCmsPage } from '../hooks/use-cms';
import type { CmsPage, CmsPageType } from '../types';
import { RichTextEditor } from './rich-text-editor';

function contentValue(page: CmsPage | undefined, type: CmsPageType): string {
  if (!page) return DEFAULT_CONTENT[type];
  const value = (page.content as Record<string, unknown> | null)?.[contentKeyFor(type)];
  return typeof value === 'string' ? value : '';
}

const PREVIEW_CSS = 'body{font:14px/1.6 system-ui,sans-serif;margin:16px;color:#0f172a;background:#fff}h1,h2{line-height:1.25}blockquote{border-left:3px solid #94a3b8;margin:0;padding-left:12px;font-style:italic}';

export function CmsPageForm({ page }: { page?: CmsPage }) {
  const router = useRouter();
  const isEdit = !!page;
  const createPage = useCreateCmsPage();
  const updatePage = useUpdateCmsPage();
  const deletePage = useDeleteCmsPage();

  const [type, setType] = React.useState<CmsPageType>(page?.type ?? 'BLOG');
  const [title, setTitle] = React.useState(page?.title ?? '');
  const [slug, setSlug] = React.useState(page?.slug ?? '');
  const [slugTouched, setSlugTouched] = React.useState(isEdit);
  const [body, setBody] = React.useState(() => contentValue(page, type));
  const [bodyIsDefault, setBodyIsDefault] = React.useState(!isEdit);
  const [isPublished, setIsPublished] = React.useState(page?.isPublished ?? false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const initial = React.useRef({ type: page?.type ?? 'BLOG', title: page?.title ?? '', body: contentValue(page, page?.type ?? 'BLOG'), isPublished: page?.isPublished ?? false });

  const dirty = isEdit
    ? type !== initial.current.type || title !== initial.current.title || body !== initial.current.body || isPublished !== initial.current.isPublished
    : title.trim().length > 0 || slug.length > 0 || !bodyIsDefault || isPublished;

  const handleTypeChange = (nextType: CmsPageType) => {
    setType(nextType);
    // Only swap in the new type's starter content while nothing real has been typed yet.
    if (bodyIsDefault) setBody(DEFAULT_CONTENT[nextType]);
  };
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };
  const handleBodyChange = (html: string) => {
    setBody(html);
    setBodyIsDefault(false);
  };

  const canSubmit = title.trim().length > 0 && slug.trim().length > 0;

  const submit = () => {
    const content = { [contentKeyFor(type)]: body };
    if (isEdit) {
      updatePage.mutate(
        { slug: page!.slug, input: { type, title, content, isPublished } },
        { onSuccess: () => { toast.success('Page updated.'); router.push('/cms'); }, onError: (err) => toast.error(toCmsError(err).message) },
      );
    } else {
      createPage.mutate(
        { slug, type, title, content, isPublished },
        { onSuccess: () => { toast.success('Page created.'); router.push('/cms'); }, onError: (err) => toast.error(toCmsError(err).message) },
      );
    }
  };

  const remove = () => {
    if (!page) return;
    deletePage.mutate(page.slug, {
      onSuccess: () => { toast.success('Page deleted.'); router.push('/cms'); },
      onError: (err) => toast.error(toCmsError(err).message),
    });
  };

  const saving = createPage.isPending || updatePage.isPending;
  const srcDoc = `<!doctype html><meta charset="utf-8"><style>${PREVIEW_CSS}</style><body>${title ? `<h1>${title.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string)}</h1>` : ''}${body}</body>`;

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Panel title="Page details" index={0}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type" htmlFor="cms-type" hint={PAGE_TYPE_META[type].description}>
                  <select id="cms-type" className={FIELD} value={type} onChange={(e) => handleTypeChange(e.target.value as CmsPageType)}>
                    {PAGE_TYPES.map((t) => <option key={t} value={t}>{PAGE_TYPE_META[t].label}</option>)}
                  </select>
                </Field>
                <Field label="Slug" htmlFor="cms-slug" hint={isEdit ? "Slug can't be changed after creation." : undefined}>
                  <input id="cms-slug" className={FIELD} value={slug} disabled={isEdit} placeholder="e.g. faq-invite-staff" onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} />
                </Field>
              </div>
              <Field label={type === 'FAQ' ? 'Question' : 'Title'} htmlFor="cms-title">
                <input id="cms-title" className={FIELD} value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder={type === 'FAQ' ? 'e.g. How do I invite a staff member?' : 'Page title'} />
              </Field>
              <label htmlFor="cms-published" className="flex cursor-pointer items-start gap-2 rounded-lg border bg-muted/30 p-3 text-[13px]">
                <Checkbox id="cms-published" className="mt-0.5" checked={isPublished} onCheckedChange={(c) => setIsPublished(c === true)} />
                <span>
                  <b className="font-semibold">Published</b> — visible to the public
                  {type === 'FAQ' || type === 'TERMS' || type === 'PRIVACY' ? <span className="text-muted-foreground"> (tenant-web reads this immediately once checked)</span> : null}
                </span>
              </label>
            </div>
          </Panel>
          <Panel title={type === 'FAQ' ? 'Answer' : 'Content'} index={1}>
            <RichTextEditor value={body} onChange={handleBodyChange} placeholder="Start writing…" minHeight={type === 'FAQ' ? '8rem' : '20rem'} />
          </Panel>
        </div>

        <Panel title="Live preview" hint="sandboxed" index={2} className="xl:sticky xl:top-20">
          <iframe title="Page preview" sandbox="" srcDoc={srcDoc} className="h-[28rem] w-full rounded-lg border bg-white xl:h-[36rem]" />
        </Panel>
      </div>

      {confirmDelete && page ? (
        <ConfirmRow text={`Delete “${page.title}”? This can't be undone.`} confirmLabel="Delete page" busy={deletePage.isPending} onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
      ) : null}

      <SaveBar dirty={dirty} message={dirty ? 'Unsaved changes' : isEdit ? 'All changes saved' : 'Fill in the details to create the page'}>
        {isEdit ? (
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={deletePage.isPending || confirmDelete}>
            <Trash2 className="mr-1.5 size-4" aria-hidden />Delete page
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => router.push('/cms')}>Cancel</Button>
        <Button onClick={submit} disabled={!canSubmit || saving || (isEdit && !dirty)}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create page'}</Button>
      </SaveBar>
    </div>
  );
}

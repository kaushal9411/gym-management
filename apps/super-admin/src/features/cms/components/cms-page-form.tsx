'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { contentKeyFor, DEFAULT_CONTENT, PAGE_TYPE_META, PAGE_TYPES, slugify } from '../constants';
import { toCmsError, useCreateCmsPage, useDeleteCmsPage, useUpdateCmsPage } from '../hooks/use-cms';
import type { CmsPage, CmsPageType } from '../types';
import { RichTextEditor } from './rich-text-editor';

const selectClassName =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring';

function contentValue(page: CmsPage | undefined, type: CmsPageType): string {
  if (!page) return DEFAULT_CONTENT[type];
  const value = (page.content as Record<string, unknown> | null)?.[contentKeyFor(type)];
  return typeof value === 'string' ? value : '';
}

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

  const handleTypeChange = (nextType: CmsPageType) => {
    setType(nextType);
    // Only swap in the new type's starter content while nothing real has
    // been typed yet — never clobber real edits, and never touch an
    // existing page's real content just because its type was changed.
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
        {
          onSuccess: () => {
            toast.success('Page updated.');
            router.push('/cms');
          },
          onError: (err) => toast.error(toCmsError(err).message),
        },
      );
    } else {
      createPage.mutate(
        { slug, type, title, content, isPublished },
        {
          onSuccess: () => {
            toast.success('Page created.');
            router.push('/cms');
          },
          onError: (err) => toast.error(toCmsError(err).message),
        },
      );
    }
  };

  const remove = () => {
    if (!page) return;
    if (!window.confirm(`Delete "${page.title}"? This can't be undone.`)) return;
    deletePage.mutate(page.slug, {
      onSuccess: () => {
        toast.success('Page deleted.');
        router.push('/cms');
      },
      onError: (err) => toast.error(toCmsError(err).message),
    });
  };

  const saving = createPage.isPending || updatePage.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Page details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select className={selectClassName} value={type} onChange={(e) => handleTypeChange(e.target.value as CmsPageType)}>
                {PAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PAGE_TYPE_META[t].label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{PAGE_TYPE_META[type].description}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cms-slug">Slug</Label>
              <Input
                id="cms-slug"
                value={slug}
                disabled={isEdit}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="e.g. faq-invite-staff"
              />
              {isEdit ? <p className="text-xs text-muted-foreground">Slug can&apos;t be changed after creation.</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cms-title">{type === 'FAQ' ? 'Question' : 'Title'}</Label>
            <Input id="cms-title" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder={type === 'FAQ' ? 'e.g. How do I invite a staff member?' : 'Page title'} />
          </div>

          <div className="space-y-1.5">
            <Label>{type === 'FAQ' ? 'Answer' : 'Content'}</Label>
            <RichTextEditor value={body} onChange={handleBodyChange} placeholder="Start writing…" minHeight={type === 'FAQ' ? '6rem' : '16rem'} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="cms-published" checked={isPublished} onCheckedChange={(c) => setIsPublished(c === true)} />
            <Label htmlFor="cms-published" className="cursor-pointer font-normal">
              Published — visible to the public {type === 'FAQ' || type === 'TERMS' || type === 'PRIVACY' ? '(tenant-web reads this immediately once checked)' : ''}
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          {isEdit ? (
            <Button variant="destructive" onClick={remove} disabled={deletePage.isPending}>
              <Trash2 className="mr-1.5 size-4" aria-hidden />
              Delete page
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/cms')}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create page'}
          </Button>
        </div>
      </div>
    </div>
  );
}

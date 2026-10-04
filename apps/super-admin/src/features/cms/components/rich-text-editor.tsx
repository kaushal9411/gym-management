'use client';

import * as React from 'react';
import { Bold, Heading2, Italic, Link as LinkIcon, List, Quote, Underline } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const TOOLBAR: Array<{ command: string; icon: React.ElementType; label: string; value?: string }> = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'formatBlock', icon: Heading2, label: 'Heading', value: '<h2>' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'formatBlock', icon: Quote, label: 'Quote', value: '<blockquote>' },
];

/**
 * Same minimal contentEditable approach as tenant-web's
 * `features/announcements/components/rich-text-editor.tsx` (ported rather
 * than shared cross-app — super-admin and tenant-web are separate Next
 * apps with no shared component package for this) — `document.execCommand`,
 * no new npm dependency. Good enough for CMS page bodies (headings/bold/
 * italic/lists/quotes/links); not a general-purpose editor.
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = '12rem' }: RichTextEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  const exec = (command: string, commandValue?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(ref.current?.innerHTML ?? '');
  };

  // Inline link bar (replaces window.prompt): remember the selection, then re-apply it when the URL is confirmed.
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const savedRange = React.useRef<Range | null>(null);
  const linkInput = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (linkOpen) linkInput.current?.focus(); }, [linkOpen]);

  const openLink = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    setLinkUrl('');
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    setLinkOpen(false);
    if (!url) return;
    ref.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    document.execCommand('createLink', false, url);
    onChange(ref.current?.innerHTML ?? '');
  };

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background shadow-xs transition-all duration-150 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1">
        {TOOLBAR.map((t, i) => (
          <Button
            key={`${t.command}-${i}`}
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-md"
            title={t.label}
            aria-label={t.label}
            onClick={() => exec(t.command, t.value)}
          >
            <t.icon className="size-3.5" />
          </Button>
        ))}
        <Button type="button" variant="ghost" size="icon" className="size-7 rounded-md" title="Link" aria-label="Insert link" onClick={openLink}>
          <LinkIcon className="size-3.5" />
        </Button>
      </div>
      {linkOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 p-1.5">
          <input
            ref={linkInput}
            type="url"
            aria-label="Link URL"
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setLinkOpen(false); }}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="button" size="sm" onClick={applyLink}>Apply</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
        </div>
      ) : null}
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="w-full max-w-none px-3.5 py-2.5 text-sm leading-relaxed outline-none empty:before:text-muted-foreground/70 empty:before:content-[attr(data-placeholder)] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_h2]:text-base [&_h2]:font-semibold [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
}

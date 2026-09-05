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

  const addLink = () => {
    const url = window.prompt('Link URL (https://...)');
    if (!url) return;
    ref.current?.focus();
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
        <Button type="button" variant="ghost" size="icon" className="size-7 rounded-md" title="Link" aria-label="Insert link" onClick={addLink}>
          <LinkIcon className="size-3.5" />
        </Button>
      </div>
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

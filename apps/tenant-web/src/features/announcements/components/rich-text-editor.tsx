'use client';

import * as React from 'react';
import { Bold, Italic, Link as LinkIcon, List, Underline } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const TOOLBAR: Array<{ command: string; icon: React.ElementType; label: string }> = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
];

/**
 * Minimal contentEditable rich-text editor via `document.execCommand` — no
 * new npm dependency (no rich-text library exists in this repo), same
 * "reach for the native browser API first" precedent as the Workout
 * module's drag-and-drop schedule editor. Good enough for an announcement's
 * bold/italic/list/link formatting; not a general-purpose editor.
 */
export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Only push the prop into the DOM when it differs and the user isn't
    // actively typing here — otherwise every keystroke's onChange→value
    // round-trip would reset the cursor to the start of the field.
    if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  const exec = (command: string) => {
    ref.current?.focus();
    document.execCommand(command);
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
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/40 p-1">
        {TOOLBAR.map((t) => (
          <Button
            key={t.command}
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-md"
            title={t.label}
            onClick={() => exec(t.command)}
          >
            <t.icon className="size-3.5" />
          </Button>
        ))}
        <Button type="button" variant="ghost" size="icon" className="size-7 rounded-md" title="Link" onClick={addLink}>
          <LinkIcon className="size-3.5" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className="min-h-32 w-full px-3.5 py-2.5 text-sm outline-none empty:before:text-muted-foreground/70 empty:before:content-[attr(data-placeholder)]"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
}

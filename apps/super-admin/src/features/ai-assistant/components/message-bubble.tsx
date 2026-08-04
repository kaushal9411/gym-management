'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AiMessageRole } from '../types';

const markdownComponents = {
  p: (props: React.ComponentPropsWithoutRef<'p'>) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props: React.ComponentPropsWithoutRef<'ul'>) => <ul className="mb-2 list-disc pl-5 last:mb-0" {...props} />,
  ol: (props: React.ComponentPropsWithoutRef<'ol'>) => <ol className="mb-2 list-decimal pl-5 last:mb-0" {...props} />,
  code: (props: React.ComponentPropsWithoutRef<'code'>) => <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10" {...props} />,
  pre: (props: React.ComponentPropsWithoutRef<'pre'>) => <pre className="mb-2 overflow-x-auto rounded-md bg-black/10 p-2 text-xs dark:bg-white/10 last:mb-0" {...props} />,
  // eslint-disable-next-line jsx-a11y/anchor-has-content -- react-markdown supplies `children` via `...props` for every real link; the rule can't see through that.
  a: (props: React.ComponentPropsWithoutRef<'a'>) => <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
  table: (props: React.ComponentPropsWithoutRef<'table'>) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  th: (props: React.ComponentPropsWithoutRef<'th'>) => <th className="border px-2 py-1 text-left font-semibold" {...props} />,
  td: (props: React.ComponentPropsWithoutRef<'td'>) => <td className="border px-2 py-1" {...props} />,
};

interface MessageBubbleProps {
  role: AiMessageRole;
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const [copied, setCopied] = React.useState(false);

  if (role === 'SYSTEM') {
    return <div className="mx-auto max-w-[90%] rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">{content}</div>;
  }

  const isUser = role === 'USER';

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard.');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn('group flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('relative max-w-[85%] rounded-2xl px-3.5 py-2 text-sm', isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
        <div className="prose-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        </div>
        {!isUser && content && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute -bottom-3 -right-1 size-6 rounded-full bg-background p-0 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
            onClick={handleCopy}
            aria-label="Copy response"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </Button>
        )}
      </div>
    </div>
  );
}

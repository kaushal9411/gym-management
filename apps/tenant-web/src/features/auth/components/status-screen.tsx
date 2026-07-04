'use client';

import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusScreenProps {
  icon: LucideIcon;
  tone?: 'neutral' | 'destructive' | 'warning' | 'success';
  title: string;
  description: string;
  /** Action buttons / links rendered under the description. */
  children?: React.ReactNode;
  /** Extra fine print (support contact, etc.). */
  footnote?: React.ReactNode;
}

const TONE_STYLES = {
  neutral: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning-foreground',
  success: 'bg-success/10 text-success',
} as const;

/**
 * Shared template for authentication status pages (session expired,
 * access denied, suspended, maintenance, …). One look, many states.
 */
export function StatusScreen({
  icon: Icon,
  tone = 'neutral',
  title,
  description,
  children,
  footnote,
}: StatusScreenProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 p-8 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className={cn('flex size-16 items-center justify-center rounded-full', TONE_STYLES[tone])}
        >
          <Icon className="size-8" aria-hidden />
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {children ? <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">{children}</div> : null}
        {footnote ? <div className="text-xs text-muted-foreground">{footnote}</div> : null}
      </CardContent>
    </Card>
  );
}

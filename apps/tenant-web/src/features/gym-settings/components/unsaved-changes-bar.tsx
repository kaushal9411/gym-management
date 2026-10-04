'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';
import { useUnsavedChangesWarning } from '../hooks/use-unsaved-changes-warning';

interface UnsavedChangesBarProps {
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/** Shared Save/Cancel bar with an unsaved-changes warning — one instance per settings form. Turns amber while dirty. */
export function UnsavedChangesBar({ isDirty, saving, onSave, onCancel }: UnsavedChangesBarProps) {
  useUnsavedChangesWarning(isDirty);
  const m = useMotionSafe();

  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-md transition-colors duration-300',
        isDirty ? 'bg-card/95' : 'bg-card/90',
      )}
      style={{ borderColor: isDirty ? 'color-mix(in oklch, var(--warning) 55%, transparent)' : undefined, backgroundImage: isDirty ? 'linear-gradient(90deg, color-mix(in oklch, var(--warning) 12%, transparent), transparent 60%)' : undefined }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDirty ? 'dirty' : 'clean'}
          initial={m.reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={m.reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
        >
          {isDirty ? (
            <>
              <AlertCircle className="size-4 shrink-0 text-warning" />
              <span className="text-foreground">You have unsaved changes.</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4 shrink-0 text-success" />
              All changes saved.
            </>
          )}
        </motion.span>
      </AnimatePresence>
      <span className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!isDirty || saving} onClick={onCancel}>
          Cancel
        </Button>
        <LoadingButton type="button" size="sm" disabled={!isDirty} loading={saving} loadingText="Saving…" onClick={onSave}>
          Save changes
        </LoadingButton>
      </span>
    </div>
  );
}

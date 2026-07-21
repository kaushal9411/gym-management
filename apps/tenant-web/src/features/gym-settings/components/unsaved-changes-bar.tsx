'use client';

import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useUnsavedChangesWarning } from '../hooks/use-unsaved-changes-warning';

interface UnsavedChangesBarProps {
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/** Shared Save/Cancel bar with an unsaved-changes warning — one instance per settings form, reused across all 4 pages. */
export function UnsavedChangesBar({ isDirty, saving, onSave, onCancel }: UnsavedChangesBarProps) {
  useUnsavedChangesWarning(isDirty);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {isDirty ? (
          <>
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            You have unsaved changes.
          </>
        ) : (
          'All changes saved.'
        )}
      </span>
      <span className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!isDirty || saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!isDirty || saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </span>
    </div>
  );
}

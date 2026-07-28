'use client';

import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
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
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-xs backdrop-blur-sm">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {isDirty ? (
          <>
            <AlertCircle className="size-4 shrink-0 text-warning" />
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
        <LoadingButton type="button" size="sm" disabled={!isDirty} loading={saving} loadingText="Saving…" onClick={onSave}>
          Save changes
        </LoadingButton>
      </span>
    </div>
  );
}

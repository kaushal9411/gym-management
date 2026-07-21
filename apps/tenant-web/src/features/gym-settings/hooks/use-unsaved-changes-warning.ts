'use client';

import * as React from 'react';

/** Native "leave site?" prompt on tab close/reload while a form has unsaved edits — the standard, dependency-free way to do this. */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}

'use client';

import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Full page reload — used by the maintenance screen. */
export function RefreshButton({ label = 'Check again' }: { label?: string }) {
  return (
    <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.location.reload()}>
      <RotateCw aria-hidden />
      {label}
    </Button>
  );
}

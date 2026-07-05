'use client';

import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

/** Always-visible affordance to reach Support from anywhere in the portal. */
export function FloatingHelpButton() {
  return (
    <Link
      href="/support"
      aria-label="Help Center"
      className="fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
    >
      <LifeBuoy className="size-5" />
    </Link>
  );
}

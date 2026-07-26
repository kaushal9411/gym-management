'use client';

import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

/** Always-visible affordance to reach Support from anywhere in the portal. */
export function FloatingHelpButton() {
  return (
    <Link
      href="/support"
      aria-label="Help Center"
      className="fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
    >
      <LifeBuoy className="size-5" />
    </Link>
  );
}

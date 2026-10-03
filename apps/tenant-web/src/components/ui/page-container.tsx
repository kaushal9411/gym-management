'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/** `/dashboard`, `/members*` and the four Staff & Access list pages (`/users`, `/roles`, `/permissions`, `/invitations`) use the full content width with a 10px gutter — its three-column layout needs the room. */
const WIDE_PAGE_PATTERN = /^\/(?:members(?:\/[^/]+)?|dashboard|users(?:\/new)?|roles|permissions|invitations)$/;

/** Consistent max-width/padding shell for every portal page's main content. */
function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname();
  const wide = WIDE_PAGE_PATTERN.test(pathname ?? '');
  return <div className={cn('mx-auto w-full space-y-6', wide ? 'p-2.5' : 'max-w-7xl p-4 md:p-6 lg:p-8', className)} {...props} />;
}

export { PageContainer };

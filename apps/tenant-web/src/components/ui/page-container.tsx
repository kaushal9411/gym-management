import * as React from 'react';

import { cn } from '@/lib/utils';

/** Consistent max-width/padding shell for every portal page's main content. */
function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6', className)} {...props} />;
}

export { PageContainer };

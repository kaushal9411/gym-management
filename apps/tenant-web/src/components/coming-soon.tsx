import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

interface ComingSoonProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
}

/** Placeholder for sidebar modules that are plan-gated but not built yet — avoids a raw 404 on click. */
export function ComingSoon({ title, icon: Icon = Construction, description }: ComingSoonProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <EmptyState
        icon={Icon}
        title="Coming soon"
        description={description ?? `${title} is on the roadmap and isn't available yet. Check back in a future update.`}
        className="min-h-[50vh] justify-center"
      />
    </div>
  );
}

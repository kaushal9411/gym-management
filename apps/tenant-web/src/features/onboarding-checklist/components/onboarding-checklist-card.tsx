'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ClipboardList, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDismissOnboardingChecklist, useOnboardingChecklist } from '../hooks/use-onboarding-checklist';

/**
 * "Get your gym set up" dashboard widget (audit remediation, Low-priority)
 * — Owner/Manager only (gated on `settings:read`, same tier as Gym
 * Settings, since every item here is something only they can act on).
 * Auto-hides once every item is complete OR once explicitly dismissed —
 * no reason to keep nudging a tenant that's already finished setting up.
 */
export function OnboardingChecklistCard() {
  const { hasPermission } = usePermissions();
  const { data, isLoading } = useOnboardingChecklist();
  const dismiss = useDismissOnboardingChecklist();

  if (!hasPermission('settings:read')) return null;
  if (isLoading || !data) return null;
  if (data.dismissed || data.completedCount === data.totalCount) return null;

  const progressPercent = Math.round((data.completedCount / data.totalCount) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'color-mix(in oklch, var(--primary) 14%, transparent)', color: 'var(--primary)' }}
          >
            <ClipboardList className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base">Get your gym set up</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.completedCount} of {data.totalCount} done
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Dismiss checklist"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate()}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="space-y-1">
          {data.items.map((item) =>
            item.completed ? (
              <div key={item.key} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                <span className="line-through">{item.label}</span>
              </div>
            ) : (
              <Link
                key={item.key}
                href={item.actionUrl}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent"
              >
                <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {item.label}
              </Link>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { Panel } from '@/features/dashboard/components/ui';
import { ModulesEditor } from './controls/modules-editor';

/** Modules tab: every module with enabled / overridden / platform-unavailable state and a per-module toggle. */
export function ModulesTab({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  return (
    <Panel title="Modules" hint="toggles apply immediately and are audited" index={0}>
      <ModulesEditor tenantId={tenantId} canManage={canManage} layout="full" />
      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        <li><b>overridden</b> — forced away from the plan default; survives plan changes.</li>
        <li><b>unavailable</b> — switched off platform-wide by a feature flag, so the tenant toggle has no effect.</li>
        <li>Core modules (dashboard, members, staff, branches) are locked on.</li>
      </ul>
    </Panel>
  );
}

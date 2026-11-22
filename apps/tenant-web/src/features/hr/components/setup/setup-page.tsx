'use client';

import * as React from 'react';
import { Clock3, PartyPopper, Plane, ScrollText, SlidersHorizontal } from 'lucide-react';

import { RequirePermission } from '@/features/auth/guards/require-permission';
import { SegmentedTabs } from '@/features/reports/components/ui';
import { useHrAccess } from '../../lib/status';
import { HrHero } from '../ui/hr-ui';
import { HolidaysPanel } from './holidays-panel';
import { LeaveTypesPanel } from './leave-types-panel';
import { PolicyPanel } from './policy-panel';
import { ShiftsPanel } from './shifts-panel';

type Tab = 'shifts' | 'holidays' | 'leave-types' | 'policy';

export function SetupPage() {
  const access = useHrAccess();
  const [tab, setTab] = React.useState<Tab>('shifts');
  return (
    <RequirePermission permission="hr:view">
      <div className="space-y-3.5">
        <HrHero eyebrow="Setup" icon={SlidersHorizontal} title="HR setup" subtitle="Shifts, holidays, leave types and the rules that drive attendance and payroll." />
        <SegmentedTabs
          ariaLabel="HR setup sections"
          value={tab}
          onChange={setTab}
          accent="analytics"
          options={[
            { value: 'shifts', label: 'Shifts', icon: Clock3 },
            { value: 'holidays', label: 'Holidays', icon: PartyPopper },
            { value: 'leave-types', label: 'Leave types', icon: Plane },
            { value: 'policy', label: 'Policy', icon: ScrollText },
          ]}
        />
        {tab === 'shifts' ? <ShiftsPanel canEdit={access.settingsManage} /> : null}
        {tab === 'holidays' ? <HolidaysPanel canEdit={access.leaveManage} /> : null}
        {tab === 'leave-types' ? <LeaveTypesPanel canEdit={access.leaveManage} /> : null}
        {tab === 'policy' ? <PolicyPanel canEdit={access.settingsManage} /> : null}
      </div>
    </RequirePermission>
  );
}

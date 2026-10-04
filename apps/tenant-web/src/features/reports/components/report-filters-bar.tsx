'use client';

import * as React from 'react';

import { Select } from '@/components/ui/select';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { PAYMENT_STATUS_META } from '@/features/finance/components/finance-badges';
import { PeriodBar } from '@/features/finance/components/payments/period-bar';
import { FieldLabel } from '@/features/finance/components/payments/payments-ui';
import { useMembershipPlanList } from '@/features/members/hooks/use-members';
import type { useReportsControls } from '../hooks/use-reports-controls';
import type { ReportAccent } from '../lib/reports-theme';
import type { TabularReportType } from '../types';
import { FilterChips } from './ui';

export interface ReportExtraFilters {
  memberStatus: string;
  planId: string;
  paymentStatus: string;
}

export const EMPTY_EXTRA_FILTERS: ReportExtraFilters = { memberStatus: '', planId: '', paymentStatus: '' };

type Controls = ReturnType<typeof useReportsControls>;

const MEMBER_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active', dotColor: 'var(--success)' },
  { value: 'INACTIVE', label: 'Inactive', dotColor: 'var(--muted-foreground)' },
  { value: 'FROZEN', label: 'Frozen', dotColor: 'var(--chart-2)' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  ...Object.entries(PAYMENT_STATUS_META).map(([value, m]) => ({ value, label: m.label, dotColor: m.color })),
];

function PlanSelect({ branchId, value, onChange }: { branchId: string; value: string; onChange: (v: string) => void }) {
  const plans = useMembershipPlanList({ page: 1, limit: 100, branchId: branchId || undefined, sortBy: 'name', sortDir: 'asc' });
  return (
    <div className="flex items-center gap-2.5">
      <FieldLabel>Plan</FieldLabel>
      <div className="min-w-[180px]">
        <Select aria-label="Filter by plan" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All plans</option>
          {(plans.data?.items ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function BranchOnlyBar({ branchId, onBranch }: { branchId: string; onBranch: (id: string) => void }) {
  const branches = useBranches();
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-[20px] border bg-card px-4 py-3.5 shadow-xs sm:px-[18px]">
      <FieldLabel>Branch</FieldLabel>
      <div className="min-w-[200px]">
        <Select aria-label="Branch" value={branchId} onChange={(e) => onBranch(e.target.value)}>
          <option value="">All branches</option>
          {(branches.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <span className="text-xs text-muted-foreground">This report is a current snapshot, so it has no date range.</span>
    </section>
  );
}

interface ReportFiltersBarProps {
  type: TabularReportType;
  accent: ReportAccent;
  controls: Controls;
  showDateRange: boolean;
  extra: ReportExtraFilters;
  onExtra: (patch: Partial<ReportExtraFilters>) => void;
}

/** Report viewer filters: period/branch/compare (date-range reports) or branch only (snapshots), plus per-report chips (membership: status + plan; payments: status). */
export function ReportFiltersBar({ type, accent, controls, showDateRange, extra, onExtra }: ReportFiltersBarProps) {
  const hasMemberFilters = type === 'membership';
  const hasPaymentFilters = type === 'payments';
  return (
    <div className="space-y-3 print:hidden">
      {showDateRange ? (
        <PeriodBar
          period={controls.period}
          onPeriod={controls.changePeriod}
          customFrom={controls.custom.from}
          customTo={controls.custom.to}
          onCustom={controls.setDates}
          branchId={controls.branchId}
          onBranch={controls.changeBranch}
          compare={controls.compare}
          onCompare={controls.setCompare}
        />
      ) : (
        <BranchOnlyBar branchId={controls.branchId} onBranch={controls.changeBranch} />
      )}
      {hasMemberFilters || hasPaymentFilters ? (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[20px] border bg-card px-4 py-3.5 shadow-xs sm:px-[18px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <FieldLabel>Status</FieldLabel>
            <FilterChips
              accent={accent}
              options={hasMemberFilters ? MEMBER_STATUS_OPTIONS : PAYMENT_STATUS_OPTIONS}
              value={hasMemberFilters ? extra.memberStatus : extra.paymentStatus}
              onChange={(v) => onExtra(hasMemberFilters ? { memberStatus: v } : { paymentStatus: v })}
            />
          </div>
          {hasMemberFilters ? <PlanSelect branchId={controls.branchId} value={extra.planId} onChange={(v) => onExtra({ planId: v })} /> : null}
        </section>
      ) : null}
    </div>
  );
}

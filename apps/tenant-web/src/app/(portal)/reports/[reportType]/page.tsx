'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { ExportButtons } from '@/features/reports/components/export-buttons';
import { ReportFiltersBar, type ReportFilterValue } from '@/features/reports/components/report-filters-bar';
import { isPaginated, useReportData } from '@/features/reports/hooks/use-reports';
import type { TabularReportType } from '@/features/reports/types';

type ReportRow = Record<string, unknown>;

interface ReportViewConfig {
  title: string;
  description: string;
  columns: Array<{ key: string; label: string }>;
  showDateRange: boolean;
}

const REPORT_VIEW_CONFIG: Record<TabularReportType, ReportViewConfig> = {
  membership: {
    title: 'Membership Report',
    description: 'Members with their current plan, status, and membership dates.',
    columns: [
      { key: 'memberCode', label: 'Member ID' },
      { key: 'name', label: 'Name' },
      { key: 'branch', label: 'Branch' },
      { key: 'plan', label: 'Plan' },
      { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start date' },
      { key: 'endDate', label: 'End date' },
    ],
    showDateRange: false,
  },
  attendance: {
    title: 'Attendance Report',
    description: 'Check-ins and check-outs over a date range.',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'memberCode', label: 'Member ID' },
      { key: 'name', label: 'Name' },
      { key: 'branch', label: 'Branch' },
      { key: 'checkInTime', label: 'Check in' },
      { key: 'checkOutTime', label: 'Check out' },
      { key: 'method', label: 'Method' },
    ],
    showDateRange: true,
  },
  revenue: {
    title: 'Revenue Report',
    description: 'Successful member payments over a date range.',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'branch', label: 'Branch' },
      { key: 'method', label: 'Method' },
      { key: 'amount', label: 'Amount' },
    ],
    showDateRange: true,
  },
  expenses: {
    title: 'Expense Report',
    description: 'Recorded expenses over a date range.',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'branch', label: 'Branch' },
      { key: 'category', label: 'Category' },
      { key: 'amount', label: 'Amount' },
      { key: 'description', label: 'Description' },
    ],
    showDateRange: true,
  },
  payments: {
    title: 'Payment Report',
    description: 'Every payment record with its status.',
    columns: [
      { key: 'paymentNumber', label: 'Payment #' },
      { key: 'memberCode', label: 'Member ID' },
      { key: 'name', label: 'Name' },
      { key: 'branch', label: 'Branch' },
      { key: 'finalAmount', label: 'Amount' },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status' },
      { key: 'paymentDate', label: 'Date' },
    ],
    showDateRange: true,
  },
  staff: {
    title: 'Staff Report',
    description: 'Managers, trainers, and receptionists.',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'branch', label: 'Branch' },
      { key: 'status', label: 'Status' },
      { key: 'joiningDate', label: 'Joined' },
    ],
    showDateRange: false,
  },
  'trainer-performance': {
    title: 'Trainer Performance Report',
    description: 'Assigned members and active plans per trainer.',
    columns: [
      { key: 'name', label: 'Trainer' },
      { key: 'assignedMembers', label: 'Assigned members' },
      { key: 'activeWorkoutPlans', label: 'Active workout plans' },
      { key: 'activeDietPlans', label: 'Active diet plans' },
    ],
    showDateRange: false,
  },
  'member-progress': {
    title: 'Member Progress Report',
    description: 'Workout and diet plan adherence per member.',
    columns: [
      { key: 'memberCode', label: 'Member ID' },
      { key: 'name', label: 'Name' },
      { key: 'workoutPlan', label: 'Workout plan' },
      { key: 'workoutProgressPercent', label: 'Workout %' },
      { key: 'dietPlan', label: 'Diet plan' },
      { key: 'dietProgressPercent', label: 'Diet %' },
    ],
    showDateRange: false,
  },
  'branch-performance': {
    title: 'Branch Performance Report',
    description: 'Members, revenue, attendance, and staff per branch.',
    columns: [
      { key: 'branch', label: 'Branch' },
      { key: 'totalMembers', label: 'Total members' },
      { key: 'activeMembers', label: 'Active members' },
      { key: 'monthlyRevenue', label: 'Monthly revenue' },
      { key: 'monthlyAttendance', label: 'Monthly attendance' },
      { key: 'staffCount', label: 'Staff' },
    ],
    showDateRange: false,
  },
  'expiring-memberships': {
    title: 'Expiring Membership Report',
    description: 'Active memberships ending within 30 days.',
    columns: [
      { key: 'memberCode', label: 'Member ID' },
      { key: 'name', label: 'Name' },
      { key: 'branch', label: 'Branch' },
      { key: 'plan', label: 'Plan' },
      { key: 'endDate', label: 'End date' },
      { key: 'daysRemaining', label: 'Days remaining' },
    ],
    showDateRange: false,
  },
  'active-vs-inactive': {
    title: 'Active vs Inactive Members Report',
    description: 'Member count grouped by status.',
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Count' },
    ],
    showDateRange: false,
  },
};

export default function ReportViewerPage() {
  const params = useParams<{ reportType: string }>();
  const reportType = params.reportType as TabularReportType;
  const config = REPORT_VIEW_CONFIG[reportType];

  const { currentBranchId } = useCurrentBranch();
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<ReportFilterValue>({ dateFrom: '', dateTo: '', branchId: '' });

  // Defaults from, and stays in sync with, the header's branch switcher —
  // still locally overridable (e.g. back to "all branches") for this page view.
  React.useEffect(() => {
    setFilters((prev) => ({ ...prev, branchId: currentBranchId ?? '' }));
    setPage(1);
  }, [currentBranchId]);

  const queryFilters = {
    page,
    limit: 20,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    branchId: filters.branchId || undefined,
  };
  const report = useReportData<ReportRow>(reportType, queryFilters);

  if (!config) {
    return <p className="text-sm text-destructive">Unknown report type.</p>;
  }

  const data = report.data;
  const paginated = isPaginated(data) ? data : null;
  const items: ReportRow[] = paginated ? paginated.items : Array.isArray(data) ? data : [];

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/reports">
          <ArrowLeft className="size-4" /> Back to Reports Center
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
          <ExportButtons reportType={reportType} filters={queryFilters} />
        </div>
      </div>

      <div className="print:hidden">
        <ReportFiltersBar
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          showDateRange={config.showDateRange}
        />
      </div>

      <DataTable
        columns={config.columns.map(
          (c): DataTableColumn<ReportRow> => ({
            key: c.key,
            header: c.label,
            render: (row) => {
              const value = row[c.key];
              return value === null || value === undefined || value === '' ? '—' : String(value);
            },
          }),
        )}
        rows={items}
        rowKey={(row) => {
          // A single field like memberCode/branchId is NOT a safe React key on
          // its own — most of these reports have several rows per member/branch
          // (e.g. one attendance row per visit), so the full row content is
          // the only thing guaranteed unique within one page of results.
          const index = items.indexOf(row);
          return `${JSON.stringify(row)}-${index}`;
        }}
        loading={report.isPending}
        error={report.error}
        onRetry={() => report.refetch()}
        emptyMessage="No data matches these filters."
      />

      {paginated && paginated.totalPages > 1 ? (
        <div className="print:hidden">
          <Pagination
            page={page}
            totalPages={paginated.totalPages}
            onPageChange={setPage}
            totalItems={paginated.total}
            pageSize={queryFilters.limit}
          />
        </div>
      ) : null}
    </div>
  );
}

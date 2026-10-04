'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { EmptyState } from '@/features/reports/components/ui';
import { ReportViewer } from '@/features/reports/components/viewer/report-viewer';
import { getCatalogEntry } from '@/features/reports/report-catalog';
import { TABULAR_REPORT_TYPES, type TabularReportType } from '@/features/reports/types';

export default function ReportViewerPage() {
  const params = useParams<{ reportType: string }>();
  const { hasPermission } = usePermissions();
  const reportType = params.reportType;
  const entry = getCatalogEntry(reportType);

  if (!hasPermission('reports:view')) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to reports.</p>;
  }

  if (!entry || entry.kind !== 'report' || !(TABULAR_REPORT_TYPES as readonly string[]).includes(reportType)) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Report not found"
        description={`"${reportType}" is not a known report type.`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">Back to Reports Center</Link>
          </Button>
        }
      />
    );
  }

  return <ReportViewer type={reportType as TabularReportType} />;
}

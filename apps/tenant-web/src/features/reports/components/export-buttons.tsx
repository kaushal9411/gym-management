'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { reportsService } from '../services/reports.service';
import { toReportError } from '../hooks/use-reports';
import type { ReportFilters } from '../types';

interface ExportButtonsProps {
  reportType: string;
  filters: ReportFilters;
}

/** "Export CSV / Export Excel" + "Download PDF" — shared across the Report Viewer and Analytics charts. */
export function ExportButtons({ reportType, filters }: ExportButtonsProps) {
  const { hasPermission } = usePermissions();
  if (!hasPermission('reports:export')) return null;

  const download = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const url = await reportsService.exportUrl(reportType, format, filters);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toReportError(err).message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => void download('csv')}>
        <Download className="size-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => void download('xlsx')}>
        <FileSpreadsheet className="size-4" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => void download('pdf')}>
        <FileText className="size-4" /> PDF
      </Button>
    </div>
  );
}

'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { HeroButton } from '@/features/finance/components/payments/payments-hero';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { reportsService } from '../services/reports.service';
import { toReportError } from '../hooks/use-reports';
import type { ReportFilters } from '../types';

interface ExportButtonsProps {
  reportType: string;
  filters: ReportFilters;
}

type Format = 'csv' | 'xlsx' | 'pdf';

const FORMATS: Array<{ format: Format; label: string; icon: typeof Download }> = [
  { format: 'csv', label: 'CSV', icon: Download },
  { format: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', icon: FileText },
];

/** CSV / Excel / PDF export buttons (hero-translucent style) — shared by the Report Viewer and the Analytics page; gated by `reports:export`. */
export function ExportButtons({ reportType, filters }: ExportButtonsProps) {
  const { hasPermission } = usePermissions();
  const [busy, setBusy] = React.useState<Format | null>(null);
  if (!hasPermission('reports:export')) return null;

  const download = async (format: Format) => {
    setBusy(format);
    try {
      const url = await reportsService.exportUrl(reportType, format, filters);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toReportError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="group" aria-label="Export report" className="flex flex-wrap items-center gap-2.5 print:hidden">
      {FORMATS.map(({ format, label, icon: Icon }) => (
        <HeroButton key={format} disabled={busy !== null} onClick={() => void download(format)}>
          {busy === format ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />} {label}
        </HeroButton>
      ))}
    </div>
  );
}

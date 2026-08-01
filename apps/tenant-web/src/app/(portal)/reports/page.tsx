'use client';

import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

import { Card, CardHeader, CardInteractive, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { REPORT_CARD_TONE_VAR, REPORT_CARDS } from '@/features/reports/components/report-cards';
import { ScheduledReportsPanel } from '@/features/reports/components/scheduled-reports-panel';

export default function ReportsCenterPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('reports:view')) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to reports.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent)',
              color: 'var(--primary)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent)',
            }}
          >
            <BarChart3 className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports Center</h1>
            <p className="text-muted-foreground">Named reports covering members, attendance, finance, staff, and branches.</p>
          </div>
        </div>
        <Link href="/analytics" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          <BarChart3 className="size-4" /> Go to Analytics Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.map((card) => (
          <Link key={card.reportType} href={`/reports/${card.reportType}`}>
            <Card className={cn('h-full hover:border-primary/50', CardInteractive)}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${REPORT_CARD_TONE_VAR[card.tone]} 16%, transparent)`,
                    color: REPORT_CARD_TONE_VAR[card.tone],
                  }}
                >
                  <card.icon className="size-4.5" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-base">{card.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <ScheduledReportsPanel />
    </div>
  );
}

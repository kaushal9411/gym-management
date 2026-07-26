import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FinanceDashboard } from '../types';

function money(amount: string | number): string {
  return `$${Number(amount).toFixed(2)}`;
}

interface FinanceSummaryCardsProps {
  summary: FinanceDashboard | undefined;
  loading?: boolean;
}

export function FinanceSummaryCards({ summary, loading }: FinanceSummaryCardsProps) {
  const cards = [
    { label: "Today's income", value: summary ? money(summary.todayIncome) : undefined },
    { label: 'Monthly income', value: summary ? money(summary.monthlyIncome) : undefined },
    { label: 'Monthly expenses', value: summary ? money(summary.monthlyExpenses) : undefined },
    {
      label: 'Outstanding payments',
      value: summary ? money(summary.outstandingPayments) : undefined,
      sub: summary ? `${summary.outstandingInvoiceCount} invoice(s)` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
                {card.sub ? <p className="text-xs text-muted-foreground">{card.sub}</p> : null}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

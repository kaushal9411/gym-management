import { CreditCard, Receipt, TrendingDown, TrendingUp } from 'lucide-react';

import { StatisticCard } from '@/components/ui/statistic-card';
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
    { label: "Today's income", value: summary ? money(summary.todayIncome) : undefined, icon: CreditCard, tone: 'primary', sub: undefined },
    { label: 'Monthly income', value: summary ? money(summary.monthlyIncome) : undefined, icon: TrendingUp, tone: 'success', sub: undefined },
    { label: 'Monthly expenses', value: summary ? money(summary.monthlyExpenses) : undefined, icon: TrendingDown, tone: 'warning', sub: undefined },
    {
      label: 'Outstanding payments',
      value: summary ? money(summary.outstandingPayments) : undefined,
      sub: summary ? `${summary.outstandingInvoiceCount} invoice(s)` : undefined,
      icon: Receipt,
      tone: 'violet',
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatisticCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
          tone={card.tone}
          loading={loading}
          trend={card.sub ? { direction: 'flat', label: card.sub } : undefined}
        />
      ))}
    </div>
  );
}

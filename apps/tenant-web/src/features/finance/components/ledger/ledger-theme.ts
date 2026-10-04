import { EXPENSE_CATEGORY_META, INCOME_CATEGORY_META, type CategoryMeta } from '../finance-badges';

/** Everything that differs between the Income and Expenses pages — passed to the shared ledger panels. */
export interface LedgerTheme {
  kind: 'income' | 'expense';
  /** Lower-case singular/plural nouns for copy ("No income in this period"). */
  noun: string;
  nounPlural: string;
  /** Chart token driving the trend line, KPI icon and top-entry bars. */
  accent: string;
  /** Expenses: a drop is good news (delta colours flip). */
  goodWhenDown: boolean;
  categoryMeta: CategoryMeta;
}

export const INCOME_THEME: LedgerTheme = { kind: 'income', noun: 'income', nounPlural: 'income entries', accent: 'var(--chart-3)', goodWhenDown: false, categoryMeta: INCOME_CATEGORY_META };
export const EXPENSE_THEME: LedgerTheme = { kind: 'expense', noun: 'expense', nounPlural: 'expenses', accent: 'var(--chart-8)', goodWhenDown: true, categoryMeta: EXPENSE_CATEGORY_META };

export interface PanelProps {
  analytics?: import('../../types').LedgerAnalytics;
  loading: boolean;
  error: boolean;
  theme: LedgerTheme;
}

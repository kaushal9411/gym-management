import type { ValueFormat } from '../../lib/format';
import { getCatalogEntry, type ReportCatalogEntry } from '../../report-catalog';

export type SeriesSlug = 'revenue-trends' | 'attendance-trends' | 'membership-growth' | 'new-member-growth' | 'retention' | 'payment-collection';
export type ViewSlug = SeriesSlug | 'branch-comparison';

export interface AnalyticsView {
  slug: ViewSlug;
  /** Catalog entry (title, description, icon, accent, export id). */
  entry: ReportCatalogEntry;
  /** `flow` = per-day amounts that add up; `snapshot` = a level measured each day (never summed). */
  kind: 'flow' | 'snapshot';
  format: ValueFormat;
  /** Two-series views: labels for the API's `income` (a) and `expenses` (b) fields. */
  dual?: { a: string; b: string; netLabel: string };
  /** Label of the single series. */
  seriesLabel: string;
  variant: 'area' | 'line';
}

const entryOf = (slug: ViewSlug): ReportCatalogEntry => getCatalogEntry(`analytics-${slug}`)!;

/** The seven analytics views in display order. Titles/labels are corrected where the API field names mislead (see inline notes). */
export const ANALYTICS_VIEWS: AnalyticsView[] = [
  { slug: 'revenue-trends', entry: entryOf('revenue-trends'), kind: 'flow', format: 'money', dual: { a: 'Income', b: 'Expenses', netLabel: 'Net' }, seriesLabel: 'Income', variant: 'area' },
  { slug: 'attendance-trends', entry: entryOf('attendance-trends'), kind: 'flow', format: 'number', seriesLabel: 'Check-ins', variant: 'area' },
  { slug: 'membership-growth', entry: entryOf('membership-growth'), kind: 'flow', format: 'number', seriesLabel: 'New memberships', variant: 'area' },
  { slug: 'new-member-growth', entry: entryOf('new-member-growth'), kind: 'flow', format: 'number', seriesLabel: 'New members', variant: 'area' },
  // Retention is a daily active-member snapshot, not a rate.
  { slug: 'retention', entry: entryOf('retention'), kind: 'snapshot', format: 'number', seriesLabel: 'Active members (daily)', variant: 'line' },
  // The API returns the invoiced total in a field named `expenses`; shown here as "Invoiced".
  { slug: 'payment-collection', entry: entryOf('payment-collection'), kind: 'flow', format: 'money', dual: { a: 'Collected', b: 'Invoiced', netLabel: 'Collection rate' }, seriesLabel: 'Collected', variant: 'area' },
  { slug: 'branch-comparison', entry: entryOf('branch-comparison'), kind: 'flow', format: 'money', seriesLabel: 'Revenue', variant: 'area' },
];

export const VIEW_BY_SLUG = new Map(ANALYTICS_VIEWS.map((v) => [v.slug, v]));
export const isViewSlug = (s: string | null): s is ViewSlug => !!s && VIEW_BY_SLUG.has(s as ViewSlug);

/** Display copy that overrides the catalog where the data is not what the catalog says. */
export const VIEW_COPY: Record<ViewSlug, { title: string; subtitle: string }> = {
  'revenue-trends': { title: 'Revenue Trends', subtitle: 'Income vs expenses per day' },
  'attendance-trends': { title: 'Attendance Trends', subtitle: 'Check-ins per day' },
  'membership-growth': { title: 'Membership Growth', subtitle: 'New memberships assigned per day' },
  'new-member-growth': { title: 'New Member Growth', subtitle: 'Members who joined per day' },
  retention: { title: 'Member Retention', subtitle: 'Active members, counted each day' },
  'payment-collection': { title: 'Payment Collection', subtitle: 'Collected payments vs invoiced amounts per day' },
  'branch-comparison': { title: 'Branch Comparison', subtitle: 'Members, revenue and attendance by branch' },
};

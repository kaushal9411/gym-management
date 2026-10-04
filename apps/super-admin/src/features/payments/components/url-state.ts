import type { InvoiceFilters, InvoiceSort, PaymentFilters, PaymentSort, PaymentsRange } from '../api/insights';

/** Payments page state lives in the URL (single source of truth). Defaults are omitted. Switching tab clears every filter but `range`. */
export type PaymentsTab = 'payments' | 'invoices';
export interface PageFilters {
  tab: PaymentsTab; range: PaymentsRange; status: string; q: string; provider: string; mode: string; currency: string;
  from: string; to: string; min: string; max: string; overdue: boolean; sort: string; dir: 'asc' | 'desc'; page: number; limit: number;
}

export const DEFAULT_LIMIT = 25;
export const RANGES: PaymentsRange[] = ['30d', '90d', '12m'];
export const PAYMENT_STATUSES = ['SUCCEEDED', 'PENDING', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
export const INVOICE_STATUSES = ['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE'];
export const PROVIDERS = ['STRIPE', 'RAZORPAY', 'PAYPAL', 'MANUAL'];
export const MODES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'];
export const PAYMENT_SORTS: PaymentSort[] = ['createdAt', 'amount', 'paidAt'];
export const INVOICE_SORTS: InvoiceSort[] = ['createdAt', 'total', 'dueDate'];

const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const num = (v: string | null) => (v && /^\d+(\.\d{1,2})?$/.test(v) ? v : '');
const oneOf = (v: string | null, all: readonly string[]) => (v && all.includes(v) ? v : '');

export function parseFilters(sp: URLSearchParams): PageFilters {
  const tab: PaymentsTab = sp.get('tab') === 'invoices' ? 'invoices' : 'payments';
  const limit = Number(sp.get('limit'));
  return {
    tab,
    range: (oneOf(sp.get('range'), RANGES) || '30d') as PaymentsRange,
    status: oneOf(sp.get('status'), tab === 'payments' ? PAYMENT_STATUSES : INVOICE_STATUSES),
    q: sp.get('q') ?? '',
    provider: oneOf(sp.get('provider'), PROVIDERS),
    mode: oneOf(sp.get('mode'), MODES),
    currency: (sp.get('currency') ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
    from: date(sp.get('from')), to: date(sp.get('to')), min: num(sp.get('min')), max: num(sp.get('max')),
    overdue: tab === 'invoices' && sp.get('overdue') === 'true',
    sort: oneOf(sp.get('sort'), tab === 'payments' ? PAYMENT_SORTS : INVOICE_SORTS) || 'createdAt',
    dir: sp.get('dir') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.floor(Number(sp.get('page'))) || 1),
    limit: [25, 50, 100].includes(limit) ? limit : DEFAULT_LIMIT,
  };
}

export function toSearchString(f: PageFilters): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: string | number, def: string | number = '') => { if (v !== def && v !== '') sp.set(k, String(v)); };
  set('tab', f.tab, 'payments'); set('range', f.range, '30d');
  set('status', f.status); set('q', f.q); set('provider', f.provider); set('mode', f.mode); set('currency', f.currency);
  set('from', f.from); set('to', f.to); set('min', f.min); set('max', f.max);
  if (f.overdue) sp.set('overdue', 'true');
  set('sort', f.sort, 'createdAt'); set('dir', f.dir, 'desc'); set('page', f.page, 1); set('limit', f.limit, DEFAULT_LIMIT);
  return sp.toString();
}

export function toPaymentQuery(f: PageFilters): PaymentFilters {
  return {
    status: f.status || undefined, provider: f.provider || undefined, tenant: f.q || undefined, from: f.from || undefined, to: f.to || undefined,
    minAmount: f.min || undefined, maxAmount: f.max || undefined, currency: f.currency.length === 3 ? f.currency : undefined, mode: f.mode || undefined,
    sort: f.sort as PaymentSort, sortDir: f.dir, page: f.page, limit: f.limit,
  };
}
export function toInvoiceQuery(f: PageFilters): InvoiceFilters {
  return {
    status: f.status || undefined, tenant: f.q || undefined, from: f.from || undefined, to: f.to || undefined, overdue: f.overdue || undefined,
    minAmount: f.min || undefined, maxAmount: f.max || undefined, currency: f.currency.length === 3 ? f.currency : undefined,
    sort: f.sort as InvoiceSort, sortDir: f.dir, page: f.page, limit: f.limit,
  };
}

/** Narrowing filters (not sort/paging/range). */
export function activeFilterCount(f: PageFilters): number {
  return [f.status, f.q, f.provider, f.mode, f.currency.length === 3 ? f.currency : '', f.from, f.to, f.min, f.max, f.overdue ? 'y' : ''].filter(Boolean).length;
}

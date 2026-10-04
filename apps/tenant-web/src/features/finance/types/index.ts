import type { Paginated } from '@/features/iam/types';

export type { Paginated };

export type MemberPaymentMethod = 'CASH' | 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE_GATEWAY';
export type MemberPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type MemberInvoiceStatus = 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';
export type IncomeCategory = 'MEMBERSHIP_FEE' | 'PERSONAL_TRAINING' | 'PRODUCT_SALES' | 'OTHER';
export type ExpenseCategory = 'RENT' | 'SALARY' | 'UTILITIES' | 'EQUIPMENT' | 'MAINTENANCE' | 'MARKETING' | 'OFFICE_SUPPLIES' | 'OTHER';

export interface MemberSummary {
  id: string;
  memberId: string;
  name: string;
}

export interface BranchSummary {
  id: string;
  name: string;
}

// ── Invoices ─────────────────────────────────────────────────────────────

export interface InvoiceItemInput {
  description: string;
  quantity?: number;
  unitPrice: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  sortOrder: number;
}

export interface GenerateInvoicePayload {
  memberId: string;
  branchId?: string;
  invoiceDate?: string;
  dueDate?: string;
  items: InvoiceItemInput[];
  taxAmount?: number;
  discountAmount?: number;
  notes?: string;
}

export interface ListInvoicesParams {
  page: number;
  limit: number;
  search?: string;
  memberId?: string;
  branchId?: string;
  status?: MemberInvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'invoiceDate' | 'dueDate' | 'totalAmount' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

/** `GET /invoices` — `summary`/`counts` are absent until the backend ships them (code defensively). */
export interface InvoiceListResponse extends Paginated<MemberInvoiceListItem> {
  summary?: { invoiced: string; collected: string; outstanding: string; count: number };
  /** Ignores the status filter — drives the status-chip counts. */
  counts?: { all: number; unpaid: number; partiallyPaid: number; paid: number; overdue: number; cancelled: number };
}

/** `GET /invoices/analytics`. */
export interface InvoiceAnalytics {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    invoiced: { value: string; previous: string };
    count: { value: number; previous: number };
    collected: { value: string; previous: string };
    avgInvoice: { value: string; previous: string };
    /** 0..1 */
    collectionRate: { value: number; previous: number };
    outstanding: { value: string; invoiceCount: number };
    overdue: { value: string; count: number };
  };
  daily: { date: string; invoiced: string; count: number; previousInvoiced: string }[];
  byStatus: { status: MemberInvoiceStatus; count: number; amount: string }[];
  aging: { bucket: string; count: number; amount: string }[];
  topDebtors: { memberId: string; memberCode: string; name: string; outstanding: string; invoiceCount: number }[];
  branches: { branchId: string; name: string; invoiced: string; collected: string }[];
}

export interface MemberInvoiceListItem {
  id: string;
  invoiceNumber: string;
  member: MemberSummary;
  branch: BranchSummary;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: MemberInvoiceStatus;
  createdAt: string;
}

export interface MemberInvoiceDetail extends MemberInvoiceListItem {
  notes: string | null;
  updatedAt: string;
  items: InvoiceItem[];
  payments: { id: string; paymentNumber: string; finalAmount: string; status: MemberPaymentStatus; paymentDate: string }[];
}

// ── Payments ─────────────────────────────────────────────────────────────

export interface CreatePaymentPayload {
  memberId: string;
  membershipId?: string;
  invoiceId?: string;
  branchId?: string;
  amount: number;
  discount?: number;
  tax?: number;
  method: MemberPaymentMethod;
  paymentDate?: string;
  transactionReference?: string;
  status?: MemberPaymentStatus;
  notes?: string;
}

export type UpdatePaymentPayload = Partial<Omit<CreatePaymentPayload, 'memberId' | 'invoiceId'>>;

// ── Razorpay online payment (Payment Links — staff send a link, never handle cards) ──

export interface CreatePaymentLinkPayload {
  memberId: string;
  membershipId?: string;
  invoiceId?: string;
  branchId?: string;
  amount: number;
  discount?: number;
  tax?: number;
  notes?: string;
  notifyEmail?: boolean;
  notifySms?: boolean;
}

export interface PaymentLinkResult {
  payment: MemberPaymentDetail;
  shortUrl: string;
  paymentLinkId: string;
  notifiedEmail: boolean;
  notifiedSms: boolean;
}

export type NotifyMedium = 'email' | 'sms';

export interface ListPaymentsParams {
  page: number;
  limit: number;
  search?: string;
  memberId?: string;
  branchId?: string;
  method?: MemberPaymentMethod;
  status?: MemberPaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  planId?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'paymentDate' | 'finalAmount' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface Refund {
  id: string;
  amount: string;
  reason: string | null;
  refundedBy: { id: string; name: string } | null;
  refundedAt: string;
}

export interface MemberPaymentListItem {
  id: string;
  paymentNumber: string;
  member: MemberSummary;
  branch: BranchSummary;
  membership: { id: string; planName: string } | null;
  invoiceId: string | null;
  amount: string;
  discount: string;
  tax: string;
  finalAmount: string;
  method: MemberPaymentMethod;
  paymentDate: string;
  transactionReference: string | null;
  status: MemberPaymentStatus;
  createdAt: string;
  /** Sum of all refunds against this payment (decimal string, `"0.00"` when none). */
  totalRefunded: string;
}

export interface MemberPaymentDetail extends MemberPaymentListItem {
  notes: string | null;
  updatedAt: string;
  recordedBy: { id: string; name: string } | null;
  refunds: Refund[];
}

/** `GET /payments` response — the usual page envelope plus whole-result totals. */
export interface PaymentListResponse extends Paginated<MemberPaymentListItem> {
  summary?: { collectedTotal: string; refundedTotal: string };
}

// ── Payments analytics (`GET /payments/analytics`) ───────────────────────

export interface AnalyticsParams {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export interface DateRange {
  from: string;
  to: string;
}

interface ValuePrev {
  value: string;
  previous: string;
}

export interface PaymentAnalytics {
  range: DateRange;
  previousRange: DateRange;
  kpis: {
    collected: ValuePrev;
    todayCollected: { value: string; count: number };
    outstanding: { value: string; invoiceCount: number };
    refunded: ValuePrev & { count: number; /** 0..1 */ rate: number };
    avgPayment: ValuePrev;
    paymentCount: { value: number; previous: number };
    /** 0..1 */
    successRate: { value: number; previous: number };
  };
  /** One row per day in `range`, zero-filled; `previousCollected` is aligned to `previousRange` by index. */
  daily: { date: string; collected: string; refunded: string; count: number; previousCollected: string }[];
  methods: { method: MemberPaymentMethod; amount: string; count: number }[];
  statuses: { status: MemberPaymentStatus; count: number }[];
  branches: { branchId: string; name: string; revenue: string; previousRevenue: string }[];
  topPlans: { planName: string; revenue: string; count: number }[];
  attention: { pendingOver24h: number; failed: number; overdueInvoices: { count: number; amount: string } };
}

export interface RefundPaymentPayload {
  amount?: number;
  reason?: string;
}

// ── Income & Expense ─────────────────────────────────────────────────────

/** `GET /income` / `GET /expenses` — page envelope plus totals over the WHOLE filtered result (not just this page). */
export interface LedgerListResponse<T> extends Paginated<T> {
  summary?: { total: string; count: number; average: string };
}

/** `GET /income/analytics` and `GET /expenses/analytics` share one shape (perm `finance:view`). Money = decimal strings. */
export interface LedgerAnalytics<C extends string = string> {
  range: DateRange;
  previousRange: DateRange;
  kpis: {
    total: ValuePrev;
    count: { value: number; previous: number };
    average: ValuePrev;
    largest: { value: string; description: string | null; category: C; date: string } | null;
    netProfit: ValuePrev;
  };
  /** One row per day in `range`; `previousTotal` is aligned to `previousRange` by index. */
  daily: { date: string; total: string; count: number; previousTotal: string }[];
  categories: { category: C; amount: string; count: number; previousAmount: string }[];
  branches: { branchId: string; name: string; total: string; previousTotal: string }[];
  topEntries: { id: string; description: string | null; category: C; amount: string; date: string }[];
}

export type IncomeAnalytics = LedgerAnalytics<IncomeCategory>;
export type ExpenseAnalytics = LedgerAnalytics<ExpenseCategory>;

export interface CreateIncomePayload {
  category: IncomeCategory;
  amount: number;
  incomeDate: string;
  branchId?: string;
  description?: string;
}

export type UpdateIncomePayload = Partial<CreateIncomePayload>;

export interface ListIncomeParams {
  page: number;
  limit: number;
  search?: string;
  category?: IncomeCategory;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted?: boolean;
  sortBy?: 'incomeDate' | 'amount' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface Income {
  id: string;
  category: IncomeCategory;
  amount: string;
  incomeDate: string;
  branch: BranchSummary | null;
  description: string | null;
  sourcePaymentId: string | null;
  recordedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateExpensePayload {
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  branchId?: string;
  description?: string;
  receiptFileName?: string;
  receiptDataUrl?: string;
}

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

export interface ListExpensesParams {
  page: number;
  limit: number;
  search?: string;
  category?: ExpenseCategory;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted?: boolean;
  sortBy?: 'expenseDate' | 'amount' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: string;
  expenseDate: string;
  branch: BranchSummary | null;
  description: string | null;
  receiptFileName: string | null;
  receiptDataUrl: string | null;
  recordedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface FinanceDashboard {
  todayIncome: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  outstandingPayments: string;
  outstandingInvoiceCount: number;
  recentPayments: MemberPaymentListItem[];
  revenueTrend: { date: string; income: number; expenses: number }[];
}

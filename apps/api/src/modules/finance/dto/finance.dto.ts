import type { ExpenseCategory, IncomeCategory, MemberInvoiceStatus, MemberPaymentMethod, MemberPaymentStatus } from '@prisma/client';

export interface MemberSummaryDto {
  id: string;
  memberId: string;
  name: string;
}

export interface BranchSummaryDto {
  id: string;
  name: string;
}

// ── Invoices ─────────────────────────────────────────────────────────────

export interface InvoiceItemInput {
  description: string;
  quantity?: number;
  unitPrice: number;
}

export interface InvoiceItemDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  sortOrder: number;
}

export interface GenerateInvoiceInput {
  memberId: string;
  branchId?: string;
  invoiceDate?: string;
  dueDate?: string;
  items: InvoiceItemInput[];
  taxAmount?: number;
  discountAmount?: number;
  notes?: string;
}

export interface ListInvoicesQuery {
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
  sortBy: 'invoiceDate' | 'dueDate' | 'totalAmount' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface InvoiceListExtrasDto {
  /** Full filtered set (incl. the status filter), ignoring pagination. count = rows in that set. */
  summary: { invoiced: string; collected: string; outstanding: string; count: number };
  /** Per effective status over the search/date/amount/branch-filtered set, IGNORING the status filter. */
  counts: { all: number; unpaid: number; partiallyPaid: number; paid: number; overdue: number; cancelled: number };
}

export interface InvoiceAnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export interface InvoiceAnalyticsDto {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    invoiced: { value: string; previous: string };
    count: { value: number; previous: number };
    collected: { value: string; previous: string };
    avgInvoice: { value: string; previous: string };
    collectionRate: { value: number; previous: number };
    outstanding: { value: string; invoiceCount: number };
    overdue: { value: string; count: number };
  };
  daily: Array<{ date: string; invoiced: string; count: number; previousInvoiced: string }>;
  byStatus: Array<{ status: MemberInvoiceStatus; count: number; amount: string }>;
  aging: Array<{ bucket: string; count: number; amount: string }>;
  topDebtors: Array<{ memberId: string; memberCode: string; name: string; outstanding: string; invoiceCount: number }>;
  branches: Array<{ branchId: string; name: string; invoiced: string; collected: string }>;
}

export interface MemberInvoiceListItemDto {
  id: string;
  invoiceNumber: string;
  member: MemberSummaryDto;
  branch: BranchSummaryDto;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: MemberInvoiceStatus;
  createdAt: string;
}

export interface MemberInvoiceDetailDto extends MemberInvoiceListItemDto {
  notes: string | null;
  updatedAt: string;
  items: InvoiceItemDto[];
  payments: {
    id: string;
    paymentNumber: string;
    finalAmount: string;
    status: MemberPaymentStatus;
    paymentDate: string;
  }[];
}

// ── Payments ─────────────────────────────────────────────────────────────

export interface CreatePaymentInput {
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

export type UpdatePaymentInput = Partial<Omit<CreatePaymentInput, 'memberId' | 'invoiceId'>>;

// ── Razorpay online payment (real gateway — distinct from the platform
// Billing module's sandboxed Stripe/Razorpay/PayPal adapters, which charge
// TENANTS for their own FitCloud subscription) — staff can only generate a
// Payment Link and send it to the member; they never see a card-entry UI. ──

export interface CreatePaymentLinkInput {
  memberId: string;
  membershipId?: string;
  invoiceId?: string;
  branchId?: string;
  amount: number;
  discount?: number;
  tax?: number;
  notes?: string;
  /** Whether Razorpay should auto-notify the member at creation time — defaults to true when the corresponding contact detail is on file. */
  notifyEmail?: boolean;
  notifySms?: boolean;
}

export interface PaymentLinkDto {
  payment: MemberPaymentDetailDto;
  shortUrl: string;
  paymentLinkId: string;
  notifiedEmail: boolean;
  notifiedSms: boolean;
}

export interface ResendPaymentLinkNotificationInput {
  medium: 'email' | 'sms';
}

export interface ListPaymentsQuery {
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
  sortBy: 'paymentDate' | 'finalAmount' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface RefundDto {
  id: string;
  amount: string;
  reason: string | null;
  refundedBy: { id: string; name: string } | null;
  refundedAt: string;
}

export interface MemberPaymentListItemDto {
  id: string;
  paymentNumber: string;
  member: MemberSummaryDto;
  branch: BranchSummaryDto;
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
  /** Sum of all refund rows for this payment (decimal string, "0.00" when none). */
  totalRefunded: string;
}

export interface MemberPaymentDetailDto extends MemberPaymentListItemDto {
  notes: string | null;
  updatedAt: string;
  recordedBy: { id: string; name: string } | null;
  refunds: RefundDto[];
}

export interface PaymentsAnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export interface PaymentsAnalyticsDto {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    collected: { value: string; previous: string };
    todayCollected: { value: string; count: number };
    outstanding: { value: string; invoiceCount: number };
    refunded: { value: string; previous: string; count: number; rate: number };
    avgPayment: { value: string; previous: string };
    paymentCount: { value: number; previous: number };
    successRate: { value: number; previous: number };
  };
  daily: Array<{
    date: string;
    collected: string;
    refunded: string;
    count: number;
    previousCollected: string;
  }>;
  methods: Array<{ method: MemberPaymentMethod; amount: string; count: number }>;
  statuses: Array<{ status: MemberPaymentStatus; count: number }>;
  branches: Array<{ branchId: string; name: string; revenue: string; previousRevenue: string }>;
  topPlans: Array<{ planName: string; revenue: string; count: number }>;
  attention: {
    pendingOver24h: number;
    failed: number;
    overdueInvoices: { count: number; amount: string };
  };
}

export interface RefundPaymentInput {
  amount?: number;
  reason?: string;
}

// ── Income & Expense ─────────────────────────────────────────────────────

export interface CreateIncomeInput {
  category: IncomeCategory;
  amount: number;
  incomeDate: string;
  branchId?: string;
  description?: string;
}

export type UpdateIncomeInput = Partial<CreateIncomeInput>;

export interface LedgerAnalyticsDto {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    total: { value: string; previous: string };
    count: { value: number; previous: number };
    average: { value: string; previous: string };
    largest: { value: string; description: string | null; category: string; date: string } | null;
    netProfit: { value: string; previous: string };
  };
  daily: Array<{ date: string; total: string; count: number; previousTotal: string }>;
  categories: Array<{ category: string; amount: string; count: number; previousAmount: string }>;
  branches: Array<{ branchId: string; name: string; total: string; previousTotal: string }>;
  topEntries: Array<{
    id: string;
    description: string | null;
    category: string;
    amount: string;
    date: string;
  }>;
}

/** Full-filtered-set totals attached to the income/expense list responses. */
export interface LedgerSummaryDto {
  total: string;
  count: number;
  average: string;
}

export interface ListIncomeQuery {
  page: number;
  limit: number;
  search?: string;
  category?: IncomeCategory;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted: boolean;
  sortBy: 'incomeDate' | 'amount' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface IncomeDto {
  id: string;
  category: IncomeCategory;
  amount: string;
  incomeDate: string;
  branch: BranchSummaryDto | null;
  description: string | null;
  sourcePaymentId: string | null;
  recordedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  branchId?: string;
  description?: string;
  receiptFileName?: string;
  receiptDataUrl?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface ListExpensesQuery {
  page: number;
  limit: number;
  search?: string;
  category?: ExpenseCategory;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeDeleted: boolean;
  sortBy: 'expenseDate' | 'amount' | 'createdAt';
  sortDir: 'asc' | 'desc';
}

export interface ExpenseDto {
  id: string;
  category: ExpenseCategory;
  amount: string;
  expenseDate: string;
  branch: BranchSummaryDto | null;
  description: string | null;
  receiptFileName: string | null;
  receiptDataUrl: string | null;
  recordedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface FinanceDashboardDto {
  todayIncome: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  outstandingPayments: string;
  outstandingInvoiceCount: number;
  recentPayments: MemberPaymentListItemDto[];
  revenueTrend: { date: string; income: number; expenses: number }[];
}

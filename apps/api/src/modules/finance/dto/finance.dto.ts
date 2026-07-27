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
  sortBy: 'invoiceDate' | 'dueDate' | 'totalAmount' | 'createdAt';
  sortDir: 'asc' | 'desc';
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
  payments: { id: string; paymentNumber: string; finalAmount: string; status: MemberPaymentStatus; paymentDate: string }[];
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
}

export interface MemberPaymentDetailDto extends MemberPaymentListItemDto {
  notes: string | null;
  updatedAt: string;
  recordedBy: { id: string; name: string } | null;
  refunds: RefundDto[];
  totalRefunded: string;
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

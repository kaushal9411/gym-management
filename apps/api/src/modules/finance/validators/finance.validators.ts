import { z } from 'zod';

const memberPaymentMethodSchema = z.enum(['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_GATEWAY']);
const memberPaymentStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED']);
const memberInvoiceStatusSchema = z.enum(['UNPAID', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED']);
const incomeCategorySchema = z.enum(['MEMBERSHIP_FEE', 'PERSONAL_TRAINING', 'PRODUCT_SALES', 'OTHER']);
const expenseCategorySchema = z.enum(['RENT', 'SALARY', 'UTILITIES', 'EQUIPMENT', 'MAINTENANCE', 'MARKETING', 'OFFICE_SUPPLIES', 'OTHER']);

export const idParamSchema = z.object({ id: z.string().uuid() });

// ── Payments ─────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  memberId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  discount: z.coerce.number().min(0).optional(),
  tax: z.coerce.number().min(0).optional(),
  method: memberPaymentMethodSchema,
  paymentDate: z.string().trim().min(1).optional(),
  transactionReference: z.string().trim().max(120).optional(),
  status: memberPaymentStatusSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updatePaymentSchema = z
  .object({
    membershipId: z.string().uuid().nullable().optional(),
    branchId: z.string().uuid().optional(),
    amount: z.coerce.number().positive().optional(),
    discount: z.coerce.number().min(0).optional(),
    tax: z.coerce.number().min(0).optional(),
    method: memberPaymentMethodSchema.optional(),
    paymentDate: z.string().trim().min(1).optional(),
    transactionReference: z.string().trim().max(120).optional(),
    status: memberPaymentStatusSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  memberId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  method: memberPaymentMethodSchema.optional(),
  status: memberPaymentStatusSchema.optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sortBy: z.enum(['paymentDate', 'finalAmount', 'createdAt']).default('paymentDate'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const refundPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().max(1000).optional(),
});

// ── Invoices ─────────────────────────────────────────────────────────────

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().positive().optional(),
  unitPrice: z.coerce.number().min(0),
});

export const generateInvoiceSchema = z.object({
  memberId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  invoiceDate: z.string().trim().min(1).optional(),
  dueDate: z.string().trim().min(1).optional(),
  items: z.array(invoiceItemSchema).min(1).max(50),
  taxAmount: z.coerce.number().min(0).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  memberId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: memberInvoiceStatusSchema.optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sortBy: z.enum(['invoiceDate', 'dueDate', 'totalAmount', 'createdAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const emailInvoiceSchema = z.object({
  email: z.string().trim().email().optional(),
});

// ── Income ───────────────────────────────────────────────────────────────

export const createIncomeSchema = z.object({
  category: incomeCategorySchema,
  amount: z.coerce.number().positive(),
  incomeDate: z.string().trim().min(1),
  branchId: z.string().uuid().optional(),
  description: z.string().trim().max(2000).optional(),
});

export const updateIncomeSchema = z
  .object({
    category: incomeCategorySchema.optional(),
    amount: z.coerce.number().positive().optional(),
    incomeDate: z.string().trim().min(1).optional(),
    branchId: z.string().uuid().optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listIncomeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  category: incomeCategorySchema.optional(),
  branchId: z.string().uuid().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['incomeDate', 'amount', 'createdAt']).default('incomeDate'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

// ── Expenses ─────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  category: expenseCategorySchema,
  amount: z.coerce.number().positive(),
  expenseDate: z.string().trim().min(1),
  branchId: z.string().uuid().optional(),
  description: z.string().trim().max(2000).optional(),
  receiptFileName: z.string().trim().min(1).max(200).optional(),
  // Same data-URL convention/size cap as `member.validators.ts#uploadMemberDocumentSchema`.
  receiptDataUrl: z
    .string()
    .max(3_000_000)
    .regex(/^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/, 'Must be a base64 data URL')
    .optional(),
});

export const updateExpenseSchema = z
  .object({
    category: expenseCategorySchema.optional(),
    amount: z.coerce.number().positive().optional(),
    expenseDate: z.string().trim().min(1).optional(),
    branchId: z.string().uuid().optional(),
    description: z.string().trim().max(2000).optional(),
    receiptFileName: z.string().trim().min(1).max(200).optional(),
    receiptDataUrl: z
      .string()
      .max(3_000_000)
      .regex(/^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/, 'Must be a base64 data URL')
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  category: expenseCategorySchema.optional(),
  branchId: z.string().uuid().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['expenseDate', 'amount', 'createdAt']).default('expenseDate'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

// ── Dashboard ────────────────────────────────────────────────────────────

export const financeDashboardQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

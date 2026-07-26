import { describe, expect, it } from 'vitest';

import {
  createExpenseSchema,
  createIncomeSchema,
  createPaymentSchema,
  generateInvoiceSchema,
  listExpensesQuerySchema,
  listIncomeQuerySchema,
  listInvoicesQuerySchema,
  listPaymentsQuerySchema,
  refundPaymentSchema,
  updateExpenseSchema,
  updateIncomeSchema,
  updatePaymentSchema,
} from './finance.validators';

describe('finance validators', () => {
  describe('createPaymentSchema', () => {
    const base = { memberId: '11111111-1111-1111-1111-111111111111', amount: 100, method: 'CASH' as const };

    it('accepts a minimal valid payload', () => {
      expect(createPaymentSchema.safeParse(base).success).toBe(true);
    });

    it('rejects a missing memberId', () => {
      expect(createPaymentSchema.safeParse({ amount: 100, method: 'CASH' }).success).toBe(false);
    });

    it('rejects an unknown payment method', () => {
      expect(createPaymentSchema.safeParse({ ...base, method: 'BITCOIN' }).success).toBe(false);
    });

    it('accepts every currently-supported payment method', () => {
      for (const method of ['CASH', 'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_GATEWAY']) {
        expect(createPaymentSchema.safeParse({ ...base, method }).success).toBe(true);
      }
    });

    it('rejects a non-positive amount', () => {
      expect(createPaymentSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
      expect(createPaymentSchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
    });

    it('coerces a numeric amount from a string', () => {
      expect(createPaymentSchema.safeParse({ ...base, amount: '150.50' }).success).toBe(true);
    });
  });

  describe('updatePaymentSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updatePaymentSchema.safeParse({}).success).toBe(false);
    });

    it('accepts a single-field partial update', () => {
      expect(updatePaymentSchema.safeParse({ notes: 'Adjusted' }).success).toBe(true);
    });
  });

  describe('listPaymentsQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listPaymentsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('paymentDate');
      expect(result.sortDir).toBe('desc');
    });

    it('rejects a limit above the max page size', () => {
      expect(listPaymentsQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });
  });

  describe('refundPaymentSchema', () => {
    it('accepts an empty body (full remaining-balance refund)', () => {
      expect(refundPaymentSchema.safeParse({}).success).toBe(true);
    });

    it('rejects a non-positive refund amount', () => {
      expect(refundPaymentSchema.safeParse({ amount: 0 }).success).toBe(false);
    });
  });

  describe('generateInvoiceSchema', () => {
    const base = { memberId: '11111111-1111-1111-1111-111111111111', items: [{ description: 'Membership fee', unitPrice: 50 }] };

    it('accepts a minimal valid payload', () => {
      expect(generateInvoiceSchema.safeParse(base).success).toBe(true);
    });

    it('rejects an empty items array', () => {
      expect(generateInvoiceSchema.safeParse({ memberId: base.memberId, items: [] }).success).toBe(false);
    });

    it('rejects a line item with an empty description', () => {
      const result = generateInvoiceSchema.safeParse({ memberId: base.memberId, items: [{ description: '', unitPrice: 50 }] });
      expect(result.success).toBe(false);
    });
  });

  describe('listInvoicesQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listInvoicesQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.sortBy).toBe('createdAt');
    });

    it('rejects an unknown status', () => {
      expect(listInvoicesQuerySchema.safeParse({ status: 'VOID' }).success).toBe(false);
    });
  });

  describe('createIncomeSchema', () => {
    it('accepts a minimal valid payload', () => {
      const result = createIncomeSchema.safeParse({ category: 'MEMBERSHIP_FEE', amount: 100, incomeDate: '2026-01-01' });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown category', () => {
      const result = createIncomeSchema.safeParse({ category: 'DONATIONS', amount: 100, incomeDate: '2026-01-01' });
      expect(result.success).toBe(false);
    });

    it('rejects a missing incomeDate', () => {
      expect(createIncomeSchema.safeParse({ category: 'OTHER', amount: 100 }).success).toBe(false);
    });
  });

  describe('updateIncomeSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateIncomeSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('listIncomeQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listIncomeQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.includeDeleted).toBe(false);
      expect(result.sortBy).toBe('incomeDate');
    });
  });

  describe('createExpenseSchema', () => {
    it('accepts a minimal valid payload', () => {
      const result = createExpenseSchema.safeParse({ category: 'RENT', amount: 1000, expenseDate: '2026-01-01' });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown category', () => {
      const result = createExpenseSchema.safeParse({ category: 'TRAVEL', amount: 1000, expenseDate: '2026-01-01' });
      expect(result.success).toBe(false);
    });

    it('rejects a non-data-URL receiptDataUrl', () => {
      const result = createExpenseSchema.safeParse({
        category: 'RENT',
        amount: 1000,
        expenseDate: '2026-01-01',
        receiptDataUrl: 'https://example.com/receipt.pdf',
      });
      expect(result.success).toBe(false);
    });

    it('accepts a valid base64 data URL receipt', () => {
      const result = createExpenseSchema.safeParse({
        category: 'RENT',
        amount: 1000,
        expenseDate: '2026-01-01',
        receiptDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateExpenseSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateExpenseSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('listExpensesQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listExpensesQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.sortBy).toBe('expenseDate');
    });
  });
});

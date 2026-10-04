import { describe, expect, it } from 'vitest';

import {
  businessDetailLines,
  businessDisplayName,
  formatInvoiceDate,
  initialsOf,
  paginateRows,
  remainingBalance,
  stampForStatus,
  sumOfSettledPayments,
} from './invoice-pdf.helpers';

const pay = (finalAmount: string, status: 'SUCCESS' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FAILED' | 'PENDING' | 'CANCELLED') => ({
  id: 'x',
  paymentNumber: 'PAY-1',
  finalAmount,
  status,
  paymentDate: '2026-10-02',
});

describe('paid / balance', () => {
  it('counts only SUCCESS and PARTIALLY_REFUNDED payments', () => {
    const paid = sumOfSettledPayments([pay('4000.00', 'SUCCESS'), pay('500', 'PARTIALLY_REFUNDED'), pay('900', 'REFUNDED'), pay('100', 'FAILED'), pay('50', 'PENDING')]);
    expect(paid).toBe(4500);
  });
  it('is 0 with no payments', () => expect(sumOfSettledPayments([])).toBe(0));
  it('balance never goes negative', () => {
    expect(remainingBalance('6510.00', 4000)).toBe(2510);
    expect(remainingBalance('100', 250)).toBe(0);
  });
});

describe('stampForStatus', () => {
  it('maps every status to a distinct label', () => {
    expect(stampForStatus('PAID').label).toBe('PAID');
    expect(stampForStatus('PARTIALLY_PAID').label).toBe('PARTIALLY PAID');
    expect(stampForStatus('UNPAID').label).toBe('UNPAID');
    expect(stampForStatus('OVERDUE').label).toBe('OVERDUE');
    expect(stampForStatus('CANCELLED').label).toBe('CANCELLED');
  });
  it('uses grey for cancelled and green for paid', () => {
    expect(stampForStatus('CANCELLED').color).toBe('#6b7090');
    expect(stampForStatus('PAID').textColor).toBe('#0d6b4a');
  });
});

describe('businessDetailLines', () => {
  it('assembles address, tax/phone and email lines', () => {
    expect(
      businessDetailLines({
        addressLine: '12 Linking Road, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400050',
        country: 'India',
        gstVatNumber: '27ABCDE1234F1Z5',
        phone: '+91 98765 43210',
        email: 'hello@x.example',
      }),
    ).toEqual(['12 Linking Road, Bandra West', 'Mumbai, Maharashtra 400050, India', 'GSTIN 27ABCDE1234F1Z5 · +91 98765 43210', 'hello@x.example']);
  });
  it('omits missing and blank parts cleanly', () => {
    expect(businessDetailLines({ city: 'Pune', addressLine: '  ', phone: '123' })).toEqual(['Pune', '123']);
    expect(businessDetailLines(null)).toEqual([]);
    expect(businessDetailLines({})).toEqual([]);
  });
});

describe('names and dates', () => {
  it('falls back to the tenant name', () => {
    expect(businessDisplayName({ legalBusinessName: ' ' }, 'Kaushal Fitness')).toBe('Kaushal Fitness');
    expect(businessDisplayName({ legalBusinessName: 'KF Pvt Ltd' }, 'x')).toBe('KF Pvt Ltd');
  });
  it('builds initials', () => {
    expect(initialsOf('Kaushal Fitness Studio Pvt Ltd')).toBe('KL');
    expect(initialsOf('Iron')).toBe('IR');
    expect(initialsOf('   ')).toBe('?');
  });
  it('formats dates like the web', () => {
    expect(formatInvoiceDate('2026-10-02')).toBe('2 Oct 2026');
    expect(formatInvoiceDate('garbage')).toBe('garbage');
  });
});

describe('paginateRows', () => {
  it('keeps everything on one page when it fits', () => {
    expect(paginateRows([10, 10, 10], 100, 200)).toEqual([[0, 1, 2]]);
  });
  it('breaks onto later pages with the larger capacity', () => {
    expect(paginateRows([40, 40, 40, 150, 40], 100, 200)).toEqual([[0, 1], [2, 3], [4]]);
  });
  it('gives an oversized row its own page and handles empty input', () => {
    expect(paginateRows([500, 10], 100, 200)).toEqual([[0], [1]]);
    expect(paginateRows([], 100, 200)).toEqual([[]]);
  });
});

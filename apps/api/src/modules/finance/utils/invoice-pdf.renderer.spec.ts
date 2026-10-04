import zlib from 'node:zlib';

import { describe, expect, it } from 'vitest';

import type { MemberInvoiceDetailDto } from '../dto/finance.dto';

import { renderInvoicePdf, type InvoicePdfInput } from './invoice-pdf.renderer';

function tinyPng(): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const invoice = (overrides: Partial<MemberInvoiceDetailDto> = {}, itemCount = 2): MemberInvoiceDetailDto => ({
  id: 'i1',
  invoiceNumber: 'INV-000087',
  member: { id: 'm1', memberId: 'MEM-0011', name: 'Ananya Nair' },
  branch: { id: 'b1', name: 'Main Branch' },
  invoiceDate: '2026-10-02',
  dueDate: '2026-10-05',
  subtotal: '6500.00',
  taxAmount: '310.00',
  discountAmount: '300.00',
  totalAmount: '6510.00',
  status: 'PARTIALLY_PAID',
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  notes: 'Renewed early.',
  items: Array.from({ length: itemCount }, (_, i) => ({
    id: `it${i}`,
    description: `Item ${i + 1} — ₹ description`,
    quantity: 1,
    unitPrice: '100.00',
    amount: '100.00',
    sortOrder: i,
  })),
  payments: [
    {
      id: 'p1',
      paymentNumber: 'PAY-000212',
      finalAmount: '4000.00',
      status: 'SUCCESS',
      paymentDate: '2026-10-02',
    },
  ],
  ...overrides,
});

const base = (inv: MemberInvoiceDetailDto, extra: Partial<InvoicePdfInput> = {}): InvoicePdfInput => ({
  invoice: inv,
  tenantName: 'Kaushal Fitness',
  profile: null,
  logo: null,
  footerText: null,
  currencySymbol: '₹',
  ...extra,
});

const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('renderInvoicePdf', () => {
  it('renders a PDF with no profile and no logo', async () => {
    const pdf = await renderInvoicePdf(base(invoice()));
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
  });

  it('renders with profile, a PNG logo, and zero payments', async () => {
    const pdf = await renderInvoicePdf(
      base(invoice({ payments: [], status: 'UNPAID' }), {
        logo: tinyPng(),
        profile: { legalBusinessName: 'KF Pvt Ltd', city: 'Mumbai', gstVatNumber: '27ABC' },
        footerText: 'Thanks!',
      }),
    );
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('falls back to the initials tile for a corrupt logo and still renders', async () => {
    const pdf = await renderInvoicePdf(base(invoice(), { logo: Buffer.from('not an image') }));
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('paginates long item lists and long notes', async () => {
    const pdf = await renderInvoicePdf(base(invoice({ notes: 'word '.repeat(600) }, 60)));
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  it('renders cancelled and paid invoices', async () => {
    expect((await renderInvoicePdf(base(invoice({ status: 'CANCELLED', payments: [] })))).subarray(0, 4).toString()).toBe('%PDF');
    expect((await renderInvoicePdf(base(invoice({ status: 'PAID' })))).subarray(0, 4).toString()).toBe('%PDF');
  });
});

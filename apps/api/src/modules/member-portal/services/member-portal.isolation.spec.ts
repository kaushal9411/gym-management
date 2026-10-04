import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const MEMBER_A = '11111111-1111-1111-1111-111111111111';
const MEMBER_B = '22222222-2222-2222-2222-222222222222';
const INVOICE_OF_B = '33333333-3333-3333-3333-333333333333';
const BOOKING_OF_B = '44444444-4444-4444-4444-444444444444';

const ROWS = {
  invoice: {
    id: INVOICE_OF_B,
    tenantId: TENANT,
    memberId: MEMBER_B,
    invoiceNumber: 'INV-B-1',
    member: { id: MEMBER_B, memberId: 'MEM-B', firstName: 'Bee', lastName: 'Member' },
    branch: { id: 'br', name: 'Main' },
    invoiceDate: new Date('2026-10-01'),
    dueDate: new Date('2026-10-10'),
    subtotal: '100',
    taxAmount: '0',
    discountAmount: '0',
    totalAmount: '100',
    status: 'UNPAID',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    payments: [],
  },
};

const calls: { model: string; op: string; args: { where?: Record<string, unknown> } }[] = [];

/** In-memory stand-in for the tenant-scoped client: applies the WHERE's tenantId/memberId/id equality like Postgres would. */
function fakeDb() {
  const matches = (row: Record<string, unknown>, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => typeof v === 'object' || row[k] === v);
  const store: Record<string, Record<string, unknown>[]> = {
    memberInvoice: [ROWS.invoice],
    classBooking: [{ id: BOOKING_OF_B, tenantId: TENANT, memberId: MEMBER_B, status: 'BOOKED' }],
  };
  return new Proxy(
    {},
    {
      get: (_t, model: string) =>
        new Proxy(
          {},
          {
            get:
              (_m, op: string) =>
              async (args: { where?: Record<string, unknown> } = {}) => {
                calls.push({ model, op, args });
                if (op === 'findFirst')
                  return (store[model] ?? []).find((r) => matches(r, args.where)) ?? null;
                return { count: 0 };
              },
          },
        ),
    },
  );
}

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => fakeDb(),
}));

import { NotFoundError } from '../../../core/errors/app-error';
import { ClassBookingService } from '../../classes/services/class-booking.service';
import { MemberInvoiceService } from '../../finance/services/member-invoice.service';
import { MemberNotificationRepository } from '../../tenant-notifications/repositories/member-notification.repository';

import { MemberOverviewService } from './member-overview.service';
import { MemberPortalService } from './member-portal.service';

beforeEach(() => {
  calls.length = 0;
});

describe('member-portal data isolation (member A must never reach member B records)', () => {
  it("MemberInvoiceService.getOwnById 404s on another member's invoice but serves the owner", async () => {
    const svc = new MemberInvoiceService(TENANT);
    await expect(svc.getOwnById(INVOICE_OF_B, MEMBER_A)).rejects.toBeInstanceOf(NotFoundError);
    await expect(svc.getOwnById(INVOICE_OF_B, MEMBER_B)).resolves.toMatchObject({
      invoiceNumber: 'INV-B-1',
    });
  });

  it('MemberInvoiceService.renderOwnPdf refuses a foreign invoice inside the service itself (before any rendering)', async () => {
    await expect(
      new MemberInvoiceService(TENANT).renderOwnPdf(INVOICE_OF_B, MEMBER_A, 'Gym'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('GET /portal/invoices/:id/download path (MemberPortalService.downloadInvoicePdf) 404s for a foreign invoice', async () => {
    await expect(
      new MemberPortalService(TENANT).downloadInvoicePdf(MEMBER_A, INVOICE_OF_B),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('GET /portal/invoices/:id (MemberOverviewService.getInvoiceDetail) 404s for a foreign invoice and exposes paid/balance to the owner', async () => {
    const svc = new MemberOverviewService(TENANT);
    await expect(svc.getInvoiceDetail(MEMBER_A, INVOICE_OF_B)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(svc.getInvoiceDetail(MEMBER_B, INVOICE_OF_B)).resolves.toMatchObject({
      paid: '0.00',
      balance: '100.00',
      branch: { name: 'Main' },
    });
  });

  it('pay-checkout start 404s for a foreign invoice', async () => {
    await expect(
      new MemberPortalService(TENANT).startInvoicePaymentCheckout(MEMBER_A, INVOICE_OF_B),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cancelling another member's booking 404s", async () => {
    await expect(
      new ClassBookingService(TENANT).cancel(BOOKING_OF_B, MEMBER_A, { role: 'MEMBER' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('marking a notification read always includes the caller memberId in the WHERE', async () => {
    await new MemberNotificationRepository(fakeDb() as never).markRead(TENANT, MEMBER_A, 'some-id');
    const update = calls.find((c) => c.model === 'memberNotification' && c.op === 'updateMany');
    expect(update?.args.where).toMatchObject({
      tenantId: TENANT,
      memberId: MEMBER_A,
      id: 'some-id',
    });
  });
});

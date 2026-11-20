import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  list: vi.fn(),
  countByStatus: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
}));
const audit = vi.hoisted(() => ({ record: vi.fn() }));

vi.mock('../repositories/admin-lead.repository', () => ({ adminLeadRepository: repo }));
vi.mock('../../admin-audit/repositories/admin-audit-log.repository', () => ({ adminAuditLogRepository: audit }));

import { AdminLeadService, toLeadStats } from './admin-lead.service';

const LEAD = { id: 'l1', status: 'NEW', contactedAt: null, notes: null };

describe('toLeadStats', () => {
  it('fills missing statuses with 0 and totals the rest', () => {
    const stats = toLeadStats([
      { status: 'NEW', count: 4 },
      { status: 'WON', count: 1 },
    ]);
    expect(stats.byStatus).toEqual({ NEW: 4, CONTACTED: 0, QUALIFIED: 0, WON: 1, LOST: 0 });
    expect(stats.total).toBe(5);
  });

  it('is all zeros for an empty table', () => {
    expect(toLeadStats([]).total).toBe(0);
  });
});

describe('AdminLeadService', () => {
  const service = new AdminLeadService();

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findById.mockResolvedValue({ ...LEAD });
    repo.update.mockImplementation(async (_id: string, data: object) => ({ ...LEAD, ...data }));
  });

  it('list pages the results and attaches per-status stats', async () => {
    repo.list.mockResolvedValue({ total: 45, items: [LEAD] });
    repo.countByStatus.mockResolvedValue([{ status: 'NEW', count: 45 }]);
    const res = await service.list({ page: 2, limit: 20, status: 'NEW' });
    expect(repo.list).toHaveBeenCalledWith({ status: 'NEW', topic: undefined, search: undefined, skip: 20, take: 20 });
    expect(res.totalPages).toBe(3);
    expect(res.stats.byStatus.NEW).toBe(45);
  });

  it('getById throws 404 for an unknown lead', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('moving a NEW lead forward stamps contactedAt once', async () => {
    await service.update('l1', { status: 'CONTACTED' }, 'admin-1', 'SUPPORT_ADMIN');
    const data = repo.update.mock.calls[0]![1] as { status: string; contactedAt?: Date };
    expect(data.status).toBe('CONTACTED');
    expect(data.contactedAt).toBeInstanceOf(Date);
  });

  it('does not overwrite an existing contactedAt', async () => {
    repo.findById.mockResolvedValue({ ...LEAD, status: 'CONTACTED', contactedAt: new Date('2026-01-01') });
    await service.update('l1', { status: 'QUALIFIED' }, 'admin-1', 'SUPPORT_ADMIN');
    expect(repo.update.mock.calls[0]![1]).not.toHaveProperty('contactedAt');
  });

  it('empty notes are stored as null', async () => {
    await service.update('l1', { notes: '' }, 'admin-1', 'SUPPORT_ADMIN');
    expect(repo.update.mock.calls[0]![1]).toEqual({ notes: null });
  });

  it('audits the change without writing the notes text', async () => {
    await service.update('l1', { status: 'LOST', notes: 'private detail' }, 'admin-1', 'SUPPORT_ADMIN');
    const entry = audit.record.mock.calls[0]![0] as { action: string; after: Record<string, unknown> };
    expect(entry.action).toBe('admin.lead_updated');
    expect(entry.after).toEqual({ status: 'LOST', notesChanged: true });
    expect(JSON.stringify(entry)).not.toContain('private detail');
  });

  it('delete removes the lead and audits it', async () => {
    await service.remove('l1', 'admin-1', 'SUPER_ADMIN');
    expect(repo.delete).toHaveBeenCalledWith('l1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.lead_deleted', entityId: 'l1' }));
  });

  it('delete of an unknown lead is a 404 and deletes nothing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.remove('nope', 'a', 'r')).rejects.toMatchObject({ httpStatus: 404 });
    expect(repo.delete).not.toHaveBeenCalled();
  });
});

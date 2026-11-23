import { describe, expect, it, vi } from 'vitest';

import { UserRepository } from './user.repository';

interface Row {
  id: string;
  tenantId: string;
  phone: string | null;
  deletedAt: Date | null;
}

/** Tiny fake of the tenant-scoped client: exact `phone` equality for findFirst, `phone: { not: null }` for findMany. */
function fakeDb(rows: Row[]) {
  const findFirst = vi.fn(async ({ where }: { where: { tenantId: string; phone: string; deletedAt: null } }) => rows.find((r) => r.tenantId === where.tenantId && r.phone === where.phone && r.deletedAt === null) ?? null);
  const findMany = vi.fn(async ({ where }: { where: { tenantId: string; deletedAt: null } }) => rows.filter((r) => r.tenantId === where.tenantId && r.deletedAt === null && r.phone !== null));
  return { db: { user: { findFirst, findMany } } as never, findFirst, findMany };
}

const row = (id: string, phone: string | null, over: Partial<Row> = {}): Row => ({ id, tenantId: 't1', phone, deletedAt: null, ...over });

describe('UserRepository.findByPhone (staff phone login)', () => {
  it('an exact stored value wins without the in-memory pass', async () => {
    const { db, findMany } = fakeDb([row('u1', '9876500000')]);
    const user = await new UserRepository(db).findByPhone('t1', '9876500000');
    expect(user?.id).toBe('u1');
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each(['9876500000', '+91 98765 00000', '+919876500000', '91 98765-00000', '09876500000'])('finds a staff stored as "+91 98765 00000" when typed "%s"', async (typed) => {
    const { db } = fakeDb([row('u1', '+91 98765 00000')]);
    expect((await new UserRepository(db).findByPhone('t1', typed))?.id).toBe('u1');
  });

  it('finds a staff stored as plain digits when typed with +91 and spaces', async () => {
    const { db } = fakeDb([row('u1', '9876500000')]);
    expect((await new UserRepository(db).findByPhone('t1', '+91 98765 00000'))?.id).toBe('u1');
  });

  it('does not match a different number, a foreign number with the same trailing digits, or another gym / deleted staff', async () => {
    const { db } = fakeDb([row('u1', '+91 98765 00000'), row('u2', '+44 7911 123456'), row('u3', '9000000000', { tenantId: 't2' }), row('u4', '9111111111', { deletedAt: new Date() })]);
    const repo = new UserRepository(db);
    expect(await repo.findByPhone('t1', '9876500001')).toBeNull();
    expect(await repo.findByPhone('t1', '7911123456')).toBeNull();
    expect(await repo.findByPhone('t1', '9000000000')).toBeNull();
    expect(await repo.findByPhone('t1', '9111111111')).toBeNull();
  });

  it('staff without a phone never match', async () => {
    const { db } = fakeDb([row('u1', null)]);
    expect(await new UserRepository(db).findByPhone('t1', '9876500000')).toBeNull();
  });
});

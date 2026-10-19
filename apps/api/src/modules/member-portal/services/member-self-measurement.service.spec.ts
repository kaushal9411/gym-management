import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

interface Row {
  id: string;
  tenantId: string;
  memberId: string;
  recordedAt: Date;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  bicepsCm: number | null;
  thighsCm: number | null;
  notes: string | null;
  recordedBy: string | null;
  source: 'STAFF' | 'MEMBER';
  recordedByUser: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  audits: [] as Array<Record<string, unknown>>,
  seq: 0,
  timezone: 'UTC',
  raceOnce: false,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => ({
    member: {
      findFirst: async () => ({ branch: { timezone: state.timezone } }),
    },
  }),
}));
vi.mock('../../authentication/repositories/audit-log.repository', () => ({
  AuditLogRepository: class {
    async record(input: Record<string, unknown>) {
      state.audits.push(input);
    }
  },
}));
vi.mock('../../measurements/repositories/measurement.repository', () => ({
  MeasurementRepository: class {
    async findById(_t: string, id: string) {
      return (state.rows as Row[]).find((r) => r.id === id) ?? null;
    }
    async findMemberEntryOnDay(_t: string, memberId: string, day: Date) {
      return (
        (state.rows as Row[]).find(
          (r) => r.memberId === memberId && r.source === 'MEMBER' && r.recordedAt.getTime() === day.getTime(),
        ) ?? null
      );
    }
    async create(data: Partial<Row>) {
      if (state.raceOnce) {
        // Simulate a concurrent request winning the unique index first.
        state.raceOnce = false;
        state.rows.push(makeRow({ id: 'raced', memberId: data.memberId!, recordedAt: data.recordedAt!, source: 'MEMBER', weightKg: 70 }));
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const row = makeRow({ id: `new-${++state.seq}`, ...data } as Partial<Row>);
      state.rows.push(row);
      return row;
    }
    async update(id: string, data: Partial<Row>) {
      const row = (state.rows as Row[]).find((r) => r.id === id)!;
      Object.assign(row, data);
      return row;
    }
    async delete(id: string) {
      state.rows = (state.rows as Row[]).filter((r) => r.id !== id);
    }
  },
}));

import { MemberSelfMeasurementService } from './member-self-measurement.service';

function makeRow(over: Partial<Row>): Row {
  return {
    id: 'x',
    tenantId: TENANT,
    memberId: ME,
    recordedAt: new Date('2026-01-01T00:00:00.000Z'),
    weightKg: null,
    heightCm: null,
    bodyFatPercent: null,
    chestCm: null,
    waistCm: null,
    hipsCm: null,
    bicepsCm: null,
    thighsCm: null,
    notes: null,
    recordedBy: null,
    source: 'MEMBER',
    recordedByUser: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

const ctx = { ipAddress: '1.1.1.1', userAgent: 'vitest' };
const dayStr = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const midnight = (day: string) => new Date(`${day}T00:00:00.000Z`);
const service = () => new MemberSelfMeasurementService(TENANT);

beforeEach(() => {
  state.rows = [];
  state.audits = [];
  state.seq = 0;
  state.timezone = 'UTC';
  state.raceOnce = false;
});

describe('MemberSelfMeasurementService#log', () => {
  it('creates a MEMBER entry for today with no recorder and audits it', async () => {
    const { measurement, created } = await service().log(ME, { weightKg: 71.4 }, ctx);
    expect(created).toBe(true);
    expect(measurement.source).toBe('MEMBER');
    expect(measurement.recordedBy).toBeNull();
    expect(measurement.recordedAt).toBe(`${dayStr()}T00:00:00.000Z`);
    expect(measurement.weightKg).toBe('71.4');
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      actorUserId: null,
      actorRole: 'MEMBER',
      action: 'member_portal.measurement_logged',
      entityType: 'body_measurement',
      entityId: measurement.id,
    });
    // Audit stores field names, never the values.
    expect(JSON.stringify(state.audits[0]!.after)).not.toContain('71.4');
  });

  it('logging again on the same day UPDATES that entry instead of duplicating (merge keeps other fields)', async () => {
    const first = await service().log(ME, { weightKg: 71, waistCm: 80 }, ctx);
    const second = await service().log(ME, { weightKg: 70.6 }, ctx);
    expect(second.created).toBe(false);
    expect(second.measurement.id).toBe(first.measurement.id);
    expect(second.measurement.weightKg).toBe('70.6');
    expect(second.measurement.waistCm).toBe('80');
    expect(state.rows).toHaveLength(1);
    expect(state.audits.map((a) => a.action)).toEqual(['member_portal.measurement_logged', 'member_portal.measurement_updated']);
  });

  it('a staff entry on the same day does not block or get merged into the member entry', async () => {
    state.rows.push(makeRow({ id: 'staff1', source: 'STAFF', recordedBy: 'u1', recordedAt: midnight(dayStr()), weightKg: 80 }));
    const { measurement, created } = await service().log(ME, { weightKg: 79 }, ctx);
    expect(created).toBe(true);
    expect(measurement.id).not.toBe('staff1');
    expect(state.rows).toHaveLength(2);
  });

  it('recovers from a concurrent same-day insert (unique index) by merging', async () => {
    state.raceOnce = true;
    const { measurement, created } = await service().log(ME, { weightKg: 72 }, ctx);
    expect(created).toBe(false);
    expect(measurement.id).toBe('raced');
    expect(measurement.weightKg).toBe('72');
  });

  it('requires at least one numeric value (notes alone is not enough)', async () => {
    await expect(service().log(ME, { notes: 'felt great' }, ctx)).rejects.toThrow(/at least one/i);
    expect(state.rows).toHaveLength(0);
  });

  it('rejects a future date', async () => {
    await expect(service().log(ME, { weightKg: 70, recordedAt: `${dayStr(2)}T00:00:00.000Z` }, ctx)).rejects.toThrow(/future/i);
    expect(state.rows).toHaveLength(0);
  });

  it('allows back-dating up to 365 days and rejects older', async () => {
    const ok = await service().log(ME, { weightKg: 70, recordedAt: dayStr(-365) }, ctx);
    expect(ok.created).toBe(true);
    await expect(service().log(ME, { weightKg: 70, recordedAt: dayStr(-366) }, ctx)).rejects.toThrow(/365/);
  });

  it('uses the branch-local date for "today" (a UTC+14 branch is already on the next UTC day)', async () => {
    state.timezone = 'Pacific/Kiritimati';
    const tomorrowUtc = dayStr(1);
    const { measurement } = await service().log(ME, { weightKg: 70 }, ctx);
    // Kiritimati is UTC+14: its "today" is the UTC date of (now + 14h).
    const expected = new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10);
    expect(measurement.recordedAt).toBe(`${expected}T00:00:00.000Z`);
    expect([dayStr(), tomorrowUtc]).toContain(expected);
  });
});

describe('MemberSelfMeasurementService#update / #delete ownership', () => {
  it('edits an own MEMBER entry and audits it', async () => {
    state.rows.push(makeRow({ id: 'mine', weightKg: 75, recordedAt: midnight(dayStr(-1)) }));
    const dto = await service().update(ME, 'mine', { weightKg: 74.2, notes: 'after leg day' }, ctx);
    expect(dto.weightKg).toBe('74.2');
    expect(dto.notes).toBe('after leg day');
    expect(state.audits.at(-1)).toMatchObject({ action: 'member_portal.measurement_updated', entityId: 'mine', actorRole: 'MEMBER' });
  });

  it('refuses to edit or delete a staff-recorded entry (403) and leaves it untouched', async () => {
    state.rows.push(makeRow({ id: 'staff1', source: 'STAFF', recordedBy: 'u1', weightKg: 80 }));
    await expect(service().update(ME, 'staff1', { weightKg: 60 }, ctx)).rejects.toMatchObject({ httpStatus: 403 });
    await expect(service().delete(ME, 'staff1', ctx)).rejects.toMatchObject({ httpStatus: 403 });
    expect((state.rows as Row[])[0]!.weightKg).toBe(80);
    expect(state.rows).toHaveLength(1);
    expect(state.audits).toHaveLength(0);
  });

  it("treats another member's entry as not found (404) for edit and delete", async () => {
    state.rows.push(makeRow({ id: 'theirs', memberId: OTHER, weightKg: 90 }));
    await expect(service().update(ME, 'theirs', { weightKg: 60 }, ctx)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(service().delete(ME, 'theirs', ctx)).rejects.toMatchObject({ httpStatus: 404 });
    expect((state.rows as Row[])[0]!.weightKg).toBe(90);
  });

  it('deletes an own entry and audits it', async () => {
    state.rows.push(makeRow({ id: 'mine', weightKg: 75 }));
    await service().delete(ME, 'mine', ctx);
    expect(state.rows).toHaveLength(0);
    expect(state.audits.at(-1)).toMatchObject({ action: 'member_portal.measurement_deleted', entityId: 'mine' });
  });

  it('moving an entry onto a day that already has a member entry is a 409', async () => {
    state.rows.push(makeRow({ id: 'a', recordedAt: midnight(dayStr(-1)), weightKg: 75 }));
    state.rows.push(makeRow({ id: 'b', recordedAt: midnight(dayStr(-2)), weightKg: 76 }));
    await expect(service().update(ME, 'a', { recordedAt: dayStr(-2) }, ctx)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('validates the new date on edit (no future)', async () => {
    state.rows.push(makeRow({ id: 'a', recordedAt: midnight(dayStr(-1)), weightKg: 75 }));
    await expect(service().update(ME, 'a', { recordedAt: dayStr(3) }, ctx)).rejects.toThrow(/future/i);
  });

  it('re-sending the entry’s own date (even one older than 365 days) is not a move and is not re-validated', async () => {
    state.rows.push(makeRow({ id: 'old', recordedAt: midnight(dayStr(-400)), weightKg: 75 }));
    const dto = await service().update(ME, 'old', { recordedAt: `${dayStr(-400)}T00:00:00.000Z`, weightKg: 74 }, ctx);
    expect(dto.weightKg).toBe('74');
    expect(dto.recordedAt).toBe(`${dayStr(-400)}T00:00:00.000Z`);
  });

  it('rejects an empty edit', async () => {
    state.rows.push(makeRow({ id: 'a', weightKg: 75 }));
    await expect(service().update(ME, 'a', {}, ctx)).rejects.toThrow(/nothing to update/i);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const ASSIGN = 'assign-1';


interface LogRow {
  id: string;
  tenantId: string;
  memberId: string;
  memberWorkoutPlanId: string;
  exerciseId: string;
  logDate: Date;
  status: 'COMPLETED' | 'SKIPPED';
  setsDone: number | null;
  repsDone: number | null;
  weightKg: number | null;
  durationMin: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  exercise: { id: string; name: string; muscleGroup: string | null };
}

interface SessionRow {
  id: string;
  tenantId: string;
  memberId: string;
  memberWorkoutPlanId: string;
  logDate: Date;
  durationMin: number | null;
  effort: number | null;
  notes: string | null;
}

const EXERCISES: Record<string, { name: string; muscleGroup: string }> = {
  squat: { name: 'Squat', muscleGroup: 'Legs' },
  lunge: { name: 'Lunge', muscleGroup: 'Legs' },
  bench: { name: 'Bench', muscleGroup: 'Chest' },
};

const state = vi.hoisted(() => ({
  logs: [] as unknown[],
  sessions: [] as unknown[],
  progress: new Map<string, { status: string; notes?: string }>(),
  progressResets: [] as string[],
  audits: [] as Array<Record<string, unknown>>,
  seq: 0,
  timezone: 'UTC',
  raceOnce: false,
  hasAssignment: true,
  planStart: '2026-10-01',
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => ({
    member: { findFirst: async () => ({ branch: { timezone: state.timezone } }) },
  }),
}));
vi.mock('../../authentication/repositories/audit-log.repository', () => ({
  AuditLogRepository: class {
    async record(input: Record<string, unknown>) {
      state.audits.push(input);
    }
  },
}));
vi.mock('../../workouts/repositories/member-workout-plan.repository', () => ({
  MemberWorkoutPlanRepository: class {
    async findActiveByMember(_t: string, memberId: string) {
      if (!state.hasAssignment || memberId !== '11111111-1111-1111-1111-111111111111') return null;
      return {
        id: 'assign-1',
        memberId,
        status: 'ACTIVE',
        startDate: new Date(state.planStart + 'T00:00:00.000Z'),
        endDate: null,
        trainerRemarks: null,
        workoutPlan: { id: 'plan-1', name: 'Plan', level: 'BEGINNER', durationWeeks: 8, exercises: [] },
        progress: [...state.progress.entries()].map(([k, v]) => ({ exerciseId: k, status: v.status, notes: v.notes ?? null, markedAt: null })),
      };
    }
    async upsertProgress(_t: string, _a: string, exerciseId: string, data: { status: string; notes?: string }) {
      state.progress.set(exerciseId, data);
    }
  },
}));
vi.mock('../repositories/member-workout-log.repository', () => ({
  MemberWorkoutLogRepository: class {
    async planSchedule() {
      // Mon: squat, lunge | Wed: bench
      return [
        { exerciseId: 'squat', dayOfWeek: 'MONDAY', sortOrder: 0, sets: 4, repetitions: 8, restSeconds: null, notes: null, exercise: { ...EXERCISES.squat, defaultSets: null, defaultReps: null, restSeconds: 90 } },
        { exerciseId: 'lunge', dayOfWeek: 'MONDAY', sortOrder: 1, sets: null, repetitions: null, restSeconds: null, notes: null, exercise: { ...EXERCISES.lunge, defaultSets: 3, defaultReps: 12, restSeconds: null } },
        { exerciseId: 'bench', dayOfWeek: 'WEDNESDAY', sortOrder: 0, sets: null, repetitions: null, restSeconds: null, notes: null, exercise: { ...EXERCISES.bench, defaultSets: null, defaultReps: null, restSeconds: null } },
      ];
    }
    async findById(_t: string, id: string) {
      return (state.logs as LogRow[]).find((r) => r.id === id) ?? null;
    }
    async findByKey(_t: string, planId: string, exerciseId: string, logDate: Date) {
      return (state.logs as LogRow[]).find((r) => r.memberWorkoutPlanId === planId && r.exerciseId === exerciseId && r.logDate.getTime() === logDate.getTime()) ?? null;
    }
    async create(data: Partial<LogRow>) {
      if (state.raceOnce) {
        state.raceOnce = false;
        state.logs.push(makeRow({ id: 'raced', exerciseId: data.exerciseId!, logDate: data.logDate!, status: 'COMPLETED', setsDone: 1 }));
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const row = makeRow({ id: `new-${++state.seq}`, ...data });
      state.logs.push(row);
      return row;
    }
    async update(id: string, data: Partial<LogRow>) {
      const row = (state.logs as LogRow[]).find((r) => r.id === id)!;
      Object.assign(row, data);
      return row;
    }
    async delete(id: string) {
      state.logs = (state.logs as LogRow[]).filter((r) => r.id !== id);
    }
    async listRange(_t: string, memberId: string, from: Date, to: Date) {
      return (state.logs as LogRow[]).filter((r) => r.memberId === memberId && r.logDate >= from && r.logDate <= to);
    }
    async listForDay(_t: string, memberId: string, logDate: Date) {
      return (state.logs as LogRow[]).filter((r) => r.memberId === memberId && r.logDate.getTime() === logDate.getTime());
    }
    async listWeighted(_t: string, memberId: string) {
      return (state.logs as LogRow[]).filter((r) => r.memberId === memberId && r.status === 'COMPLETED' && r.weightKg !== null);
    }
    async count(_t: string, memberId: string) {
      return (state.logs as LogRow[]).filter((r) => r.memberId === memberId).length;
    }
    async latestForExercise(_t: string, planId: string, exerciseId: string) {
      return (
        (state.logs as LogRow[])
          .filter((r) => r.memberWorkoutPlanId === planId && r.exerciseId === exerciseId)
          .sort((a, b) => b.logDate.getTime() - a.logDate.getTime())[0] ?? null
      );
    }
    async deleteForDay(_t: string, memberId: string, logDate: Date) {
      state.logs = (state.logs as LogRow[]).filter((r) => !(r.memberId === memberId && r.logDate.getTime() === logDate.getTime()));
    }
    async findSession(_t: string, memberId: string, logDate: Date) {
      return (state.sessions as SessionRow[]).find((s) => s.memberId === memberId && s.logDate.getTime() === logDate.getTime()) ?? null;
    }
    async createSession(data: Partial<SessionRow>) {
      const row = { id: `s-${++state.seq}`, durationMin: null, effort: null, notes: null, ...data } as SessionRow;
      state.sessions.push(row);
      return row;
    }
    async updateSession(id: string, data: Partial<SessionRow>) {
      const row = (state.sessions as SessionRow[]).find((s) => s.id === id)!;
      Object.assign(row, data);
      return row;
    }
    async deleteSessionForDay(_t: string, memberId: string, logDate: Date) {
      state.sessions = (state.sessions as SessionRow[]).filter((s) => !(s.memberId === memberId && s.logDate.getTime() === logDate.getTime()));
    }
    async listSessions(_t: string, memberId: string, from: Date, to: Date) {
      return (state.sessions as SessionRow[]).filter((s) => s.memberId === memberId && s.logDate >= from && s.logDate <= to);
    }
    async resetProgress(_t: string, _a: string, exerciseId: string) {
      state.progressResets.push(exerciseId);
      if (state.progress.has(exerciseId)) state.progress.set(exerciseId, { status: 'PENDING' });
    }
  },
}));

import { MemberWorkoutLogRepository } from '../repositories/member-workout-log.repository';

import { MemberWorkoutLogService } from './member-workout-log.service';

function makeRow(over: Partial<LogRow>): LogRow {
  const ex = EXERCISES[over.exerciseId ?? 'squat'] ?? EXERCISES.squat!;
  return {
    id: 'x',
    tenantId: TENANT,
    memberId: ME,
    memberWorkoutPlanId: ASSIGN,
    exerciseId: 'squat',
    logDate: new Date('2026-10-19T00:00:00.000Z'),
    status: 'COMPLETED',
    setsDone: null,
    repsDone: null,
    weightKg: null,
    durationMin: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    exercise: { id: over.exerciseId ?? 'squat', ...ex },
    ...over,
  };
}

const ctx = { ipAddress: '1.1.1.1', userAgent: 'vitest' };
const service = () => new MemberWorkoutLogService(TENANT);
// System clock: Wed 2026-10-21 08:00 UTC. Monday 2026-10-19 is two days back; Mon 10-12 is 9 days back.
const MON = '2026-10-19';
const WED = '2026-10-21';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T08:00:00.000Z'));
  state.logs = [];
  state.sessions = [];
  state.progress = new Map();
  state.progressResets = [];
  state.audits = [];
  state.seq = 0;
  state.timezone = 'UTC';
  state.raceOnce = false;
  state.hasAssignment = true;
  state.planStart = '2026-10-01';
});
afterEach(() => vi.useRealTimers());

describe('log', () => {
  it('creates an entry (201 semantics), mirrors the legacy progress and audits field names only', async () => {
    const r = await service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED', setsDone: 4, repsDone: 8, weightKg: 60 }, ctx);
    expect(r.created).toBe(true);
    expect(r.entry).toMatchObject({ exerciseId: 'squat', date: MON, status: 'COMPLETED', setsDone: 4, weightKg: 60, exerciseName: 'Squat' });
    expect(state.progress.get('squat')?.status).toBe('COMPLETED');
    expect(r.workout.tracking.days.find((d) => d.date === MON)?.exercises[0]).toMatchObject({ status: 'COMPLETED', weightKg: 60 });
    expect(r.workout.progress.find((p) => p.exerciseId === 'squat')?.status).toBe('COMPLETED');
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ actorUserId: null, actorRole: 'MEMBER', action: 'member_portal.workout_logged', entityType: 'member_workout_log' });
    expect(JSON.stringify(state.audits[0]?.after)).not.toContain('60');
    expect(state.audits[0]?.after).toMatchObject({ memberId: ME, day: MON, fields: expect.arrayContaining(['status', 'weightKg']) });
  });

  it('defaults to today (branch timezone) and rejects a day the exercise is not scheduled', async () => {
    await expect(service().log(ME, { exerciseId: 'squat', status: 'COMPLETED' }, ctx)).rejects.toThrow(/isn’t scheduled for Wednesday/);
    const ok = await service().log(ME, { exerciseId: 'bench', status: 'COMPLETED' }, ctx);
    expect(ok.entry.date).toBe(WED);
  });

  it('uses the member’s branch timezone for "today"', async () => {
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));
    state.timezone = 'Pacific/Auckland'; // 01:00 on Thursday 2026-10-22 there
    await expect(service().log(ME, { exerciseId: 'squat', date: '2026-10-22', status: 'COMPLETED' }, ctx)).rejects.toThrow(/Nothing is scheduled for Thursday/);
    // a Thursday log is allowed to be "today" there -> the failure above is the schedule, not "future"
    await expect(service().log(ME, { exerciseId: 'bench', date: '2026-10-23', status: 'COMPLETED' }, ctx)).rejects.toThrow(/future/);
  });

  it('logging the same exercise/day again updates (200 semantics) and keeps unsent fields', async () => {
    const first = await service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED', setsDone: 4, repsDone: 8, weightKg: 60 }, ctx);
    const again = await service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED', weightKg: 62.5 }, ctx);
    expect(again.created).toBe(false);
    expect(again.entry.id).toBe(first.entry.id);
    expect(again.entry).toMatchObject({ setsDone: 4, repsDone: 8, weightKg: 62.5 });
    expect(state.logs).toHaveLength(1);
    expect(state.audits[1]?.action).toBe('member_portal.workout_log_updated');
  });

  it('null clears a field; marking skipped clears all details', async () => {
    await service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED', setsDone: 4, weightKg: 60 }, ctx);
    const cleared = await service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED', weightKg: null }, ctx);
    expect(cleared.entry).toMatchObject({ setsDone: 4, weightKg: null });
    const skipped = await service().log(ME, { exerciseId: 'squat', date: MON, status: 'SKIPPED' }, ctx);
    expect(skipped.entry).toMatchObject({ status: 'SKIPPED', setsDone: null, weightKg: null });
    expect(state.progress.get('squat')?.status).toBe('SKIPPED');
  });

  it('rounds the weight to 2 decimals and stores blank notes as null', async () => {
    const r = await service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED', weightKg: 42.555, notes: '' }, ctx);
    expect(r.entry.weightKg).toBe(42.56);
    expect(r.entry.notes).toBeNull();
  });

  it('enforces the date window: no future, at most 14 days back, valid date', async () => {
    await expect(service().log(ME, { exerciseId: 'bench', date: '2026-10-28', status: 'COMPLETED' }, ctx)).rejects.toThrow(/future/);
    await expect(service().log(ME, { exerciseId: 'squat', date: '2026-10-05', status: 'COMPLETED' }, ctx)).rejects.toThrow(/14 days/);
    await expect(service().log(ME, { exerciseId: 'squat', date: 'nope', status: 'COMPLETED' }, ctx)).rejects.toThrow(/valid date/);
    // exactly 14 days back (Wed 10-07, inside the plan) is fine: bench is scheduled on Wednesdays
    state.planStart = '2026-09-01';
    const ok = await service().log(ME, { exerciseId: 'bench', date: '2026-10-07', status: 'COMPLETED' }, ctx);
    expect(ok.created).toBe(true);
  });

  it('rejects an exercise outside the plan, and days before the plan started', async () => {
    await expect(service().log(ME, { exerciseId: 'deadlift', date: MON, status: 'COMPLETED' }, ctx)).rejects.toThrow(/not part of your assigned workout plan/);
    // plan starts 2026-10-10: Wed 10-07 is inside the 14-day window but before the start
    state.planStart = '2026-10-10';
    await expect(service().log(ME, { exerciseId: 'bench', date: '2026-10-07', status: 'COMPLETED' }, ctx)).rejects.toThrow(/Your plan starts on 2026-10-10/);
  });

  it('404 when the member has no active plan', async () => {
    state.hasAssignment = false;
    await expect(service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED' }, ctx)).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('a lost unique-key race becomes an update of the winner, not a 500', async () => {
    state.raceOnce = true;
    const r = await service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED', repsDone: 9 }, ctx);
    expect(r.created).toBe(false);
    expect(r.entry.id).toBe('raced');
    expect(r.entry.repsDone).toBe(9);
    expect(state.logs).toHaveLength(1);
  });

  it('rethrows non-unique database errors', async () => {
    const spy = vi.spyOn(MemberWorkoutLogRepository.prototype, 'create').mockRejectedValueOnce(new Error('db down'));
    await expect(service().log(ME, { exerciseId: 'squat', date: MON, status: 'COMPLETED' }, ctx)).rejects.toThrow('db down');
    spy.mockRestore();
  });
});

describe('update / remove ownership and progress sync', () => {
  async function seed(memberId = ME) {
    const row = makeRow({ id: 'e1', memberId, exerciseId: 'squat', setsDone: 4, weightKg: 60 });
    state.logs.push(row);
    state.progress.set('squat', { status: 'COMPLETED' });
    return row;
  }

  it("another member's entry is a 404 for PATCH and DELETE (never revealed)", async () => {
    await seed(OTHER);
    await expect(service().update(ME, 'e1', { weightKg: 70 }, ctx)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(service().remove(ME, 'e1', ctx)).rejects.toMatchObject({ httpStatus: 404 });
    expect(state.logs).toHaveLength(1);
    expect(state.audits).toHaveLength(0);
  });

  it('missing id is 404', async () => {
    await expect(service().update(ME, 'nope', { weightKg: 70 }, ctx)).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('PATCH edits details of an own entry of any age and audits field names', async () => {
    const old = makeRow({ id: 'old', exerciseId: 'squat', logDate: new Date('2026-08-03T00:00:00.000Z'), weightKg: 40 });
    state.logs.push(old);
    const r = await service().update(ME, 'old', { weightKg: 45, notes: 'typo fix' }, ctx);
    expect(r.entry).toMatchObject({ weightKg: 45, notes: 'typo fix', date: '2026-08-03' });
    expect(state.audits[0]).toMatchObject({ action: 'member_portal.workout_log_updated' });
  });

  it('PATCH to SKIPPED clears details; details on a skipped entry are rejected', async () => {
    await seed();
    const r = await service().update(ME, 'e1', { status: 'SKIPPED' }, ctx);
    expect(r.entry).toMatchObject({ status: 'SKIPPED', setsDone: null, weightKg: null });
    await expect(service().update(ME, 'e1', { weightKg: 20 }, ctx)).rejects.toThrow(/Mark the exercise as done/);
    const back = await service().update(ME, 'e1', { status: 'COMPLETED', weightKg: 20 }, ctx);
    expect(back.entry).toMatchObject({ status: 'COMPLETED', weightKg: 20 });
  });

  it('DELETE removes the entry and resets the legacy progress when no log remains', async () => {
    await seed();
    await service().remove(ME, 'e1', ctx);
    expect(state.logs).toHaveLength(0);
    expect(state.progressResets).toEqual(['squat']);
    expect(state.progress.get('squat')?.status).toBe('PENDING');
    expect(state.audits[0]).toMatchObject({ action: 'member_portal.workout_log_deleted' });
  });

  it('DELETE mirrors the previous day’s status when an older log remains', async () => {
    state.logs.push(makeRow({ id: 'older', exerciseId: 'squat', logDate: new Date('2026-10-12T00:00:00.000Z'), status: 'SKIPPED' }));
    await seed();
    await service().remove(ME, 'e1', ctx);
    expect(state.progress.get('squat')?.status).toBe('SKIPPED');
    expect(state.progressResets).toHaveLength(0);
  });
});

describe('completeDay', () => {
  it('completes every unlogged exercise, keeps skipped ones, stores duration / effort, mirrors progress', async () => {
    state.logs.push(makeRow({ id: 'sk', exerciseId: 'lunge', logDate: new Date(`${MON}T00:00:00.000Z`), status: 'SKIPPED' }));
    const r = await service().completeDay(ME, { date: MON, durationMin: 50, effort: 4 }, ctx);
    expect(r.completedNow).toBe(1);
    const day = r.workout.tracking.days.find((d) => d.date === MON)!;
    expect(day.state).toBe('DONE');
    expect(day.exercises.map((e) => e.status)).toEqual(['COMPLETED', 'SKIPPED']);
    expect(day.session).toEqual({ durationMin: 50, effort: 4, notes: null });
    expect(state.progress.get('squat')?.status).toBe('COMPLETED');
    expect(state.audits.at(-1)).toMatchObject({ action: 'member_portal.workout_session_completed' });
  });

  it('is idempotent and merges session fields on a second call', async () => {
    await service().completeDay(ME, { date: MON, durationMin: 50 }, ctx);
    const again = await service().completeDay(ME, { date: MON, effort: 5 }, ctx);
    expect(again.completedNow).toBe(0);
    expect(state.sessions).toHaveLength(1);
    expect(again.workout.tracking.days.find((d) => d.date === MON)?.session).toMatchObject({ durationMin: 50, effort: 5 });
  });

  it('writes no session row when no metadata was sent', async () => {
    await service().completeDay(ME, { date: MON }, ctx);
    expect(state.sessions).toHaveLength(0);
  });

  it('rejects rest days, the future and an all-skipped day', async () => {
    await expect(service().completeDay(ME, { date: '2026-10-20' }, ctx)).rejects.toThrow(/Nothing is scheduled for Tuesday/);
    await expect(service().completeDay(ME, { date: '2026-10-26' }, ctx)).rejects.toThrow(/future/);
    state.logs.push(
      makeRow({ id: 's1', exerciseId: 'squat', logDate: new Date(`${MON}T00:00:00.000Z`), status: 'SKIPPED' }),
      makeRow({ id: 's2', exerciseId: 'lunge', logDate: new Date(`${MON}T00:00:00.000Z`), status: 'SKIPPED' }),
    );
    await expect(service().completeDay(ME, { date: MON }, ctx)).rejects.toThrow(/marked skipped/);
  });

  it('a concurrent insert of one exercise is kept, not duplicated', async () => {
    state.raceOnce = true;
    const r = await service().completeDay(ME, { date: MON }, ctx);
    expect(r.workout.tracking.days.find((d) => d.date === MON)?.state).toBe('DONE');
    expect(state.logs).toHaveLength(2);
  });
});

describe('resetDay and history', () => {
  it('clears only the caller’s entries for the day, the session row, and mirrors progress', async () => {
    state.logs.push(
      makeRow({ id: 'mine', exerciseId: 'squat', logDate: new Date(`${MON}T00:00:00.000Z`) }),
      makeRow({ id: 'theirs', memberId: OTHER, memberWorkoutPlanId: 'assign-other', exerciseId: 'squat', logDate: new Date(`${MON}T00:00:00.000Z`) }),
    );
    state.sessions.push({ id: 's', tenantId: TENANT, memberId: ME, memberWorkoutPlanId: ASSIGN, logDate: new Date(`${MON}T00:00:00.000Z`), durationMin: 30, effort: 3, notes: null });
    state.progress.set('squat', { status: 'COMPLETED' });
    await service().resetDay(ME, MON, ctx);
    expect((state.logs as LogRow[]).map((r) => r.id)).toEqual(['theirs']);
    expect(state.sessions).toHaveLength(0);
    expect(state.progressResets).toEqual(['squat']);
    expect(state.audits[0]).toMatchObject({ action: 'member_portal.workout_day_reset' });
  });

  it('reset follows the date window rules', async () => {
    await expect(service().resetDay(ME, '2026-10-30', ctx)).rejects.toThrow(/future/);
    await expect(service().resetDay(ME, '2026-08-01', ctx)).rejects.toThrow(/14 days/);
  });

  it('history only returns the caller’s rows, within the requested days', async () => {
    state.logs.push(
      makeRow({ id: 'a', exerciseId: 'squat', logDate: new Date(`${MON}T00:00:00.000Z`) }),
      makeRow({ id: 'b', memberId: OTHER, exerciseId: 'squat', logDate: new Date(`${MON}T00:00:00.000Z`) }),
      makeRow({ id: 'c', exerciseId: 'squat', logDate: new Date('2026-06-01T00:00:00.000Z') }),
    );
    const h = await service().history(ME, 30);
    expect(h.today).toBe(WED);
    expect(h.entries.map((e) => e.id)).toEqual(['a']);
  });
});

describe('getWorkoutPayload', () => {
  it('is null without an assignment, and keeps the legacy fields intact with tracking added', async () => {
    state.hasAssignment = false;
    expect(await service().getWorkoutPayload(ME)).toBeNull();
    state.hasAssignment = true;
    const p = (await service().getWorkoutPayload(ME))!;
    expect(Object.keys(p).sort()).toEqual(['endDate', 'id', 'progress', 'startDate', 'status', 'tracking', 'trainerRemarks', 'workoutPlan']);
    expect(p.tracking.everLogged).toBe(false);
    expect(p.tracking.insights[0]?.title).toBe('Log your first workout');
  });

  it('is scoped to the member: another member has no assignment', async () => {
    expect(await service().getWorkoutPayload(OTHER)).toBeNull();
  });
});

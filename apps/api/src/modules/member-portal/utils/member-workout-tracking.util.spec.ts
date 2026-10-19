import { describe, expect, it } from 'vitest';

import {
  CONSISTENCY_WEEKS,
  MAX_INSIGHTS,
  WORKOUT_LOG_BACKDATE_DAYS,
  addDays,
  buildWorkoutTracking,
  daysBetween,
  focusOf,
  isCalendarDay,
  plannedExercisesOn,
  resolveWorkoutLogDay,
  weekStartOf,
  weekdayOf,
  type PlanExerciseInfo,
  type TrackingInput,
  type WeekDayName,
  type WorkoutLogEntry,
  type WorkoutSessionEntry,
} from './member-workout-tracking.util';

// 2026-10-21 is a Wednesday. Weeks: ... 10-05, 10-12, 10-19 (current).
const TODAY = '2026-10-21';
const ASSIGN = 'a1';

function ex(id: string, dayOfWeek: WeekDayName, over: Partial<PlanExerciseInfo> = {}): PlanExerciseInfo {
  return {
    exerciseId: id,
    name: `Ex ${id}`,
    muscleGroup: null,
    dayOfWeek,
    sortOrder: 0,
    sets: null,
    reps: null,
    restSeconds: null,
    notes: null,
    ...over,
  };
}

let seq = 0;
function log(date: string, exerciseId: string, status: 'COMPLETED' | 'SKIPPED' = 'COMPLETED', over: Partial<WorkoutLogEntry> = {}): WorkoutLogEntry {
  seq += 1;
  return {
    id: `l${seq}`,
    assignmentId: ASSIGN,
    date,
    exerciseId,
    status,
    setsDone: null,
    repsDone: null,
    weightKg: null,
    durationMin: null,
    notes: null,
    ...over,
  };
}

function session(date: string, over: Partial<WorkoutSessionEntry> = {}): WorkoutSessionEntry {
  seq += 1;
  return { id: `s${seq}`, date, durationMin: null, effort: null, notes: null, ...over };
}

/** Mon/Wed/Fri plan: Mon = a,b (Legs) / Wed = c / Fri = d,e (Chest). */
const SCHEDULE: PlanExerciseInfo[] = [
  ex('a', 'MONDAY', { muscleGroup: 'Legs', sortOrder: 0 }),
  ex('b', 'MONDAY', { muscleGroup: 'Legs', sortOrder: 1 }),
  ex('c', 'WEDNESDAY', { muscleGroup: 'Back' }),
  ex('d', 'FRIDAY', { muscleGroup: 'Chest', sortOrder: 0 }),
  ex('e', 'FRIDAY', { muscleGroup: 'Chest', sortOrder: 1 }),
];

function input(over: Partial<TrackingInput> = {}): TrackingInput {
  return {
    today: TODAY,
    assignment: { id: ASSIGN, startDate: '2026-09-01', endDate: null },
    schedule: SCHEDULE,
    logs: [],
    sessions: [],
    weighted: [],
    everLogged: true,
    ...over,
  };
}

const dayOf = (t: ReturnType<typeof buildWorkoutTracking>, date: string) => t.days.find((d) => d.date === date)!;

describe('calendar helpers', () => {
  it('weekdayOf / weekStartOf use Monday-first weeks', () => {
    expect(weekdayOf('2026-10-19')).toBe('MONDAY');
    expect(weekdayOf('2026-10-25')).toBe('SUNDAY');
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19');
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19');
    expect(weekStartOf('2026-10-21')).toBe('2026-10-19');
  });

  it('addDays / daysBetween cross month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2026-10-15')).toBe(14);
  });

  it('isCalendarDay rejects impossible dates', () => {
    expect(isCalendarDay('2026-02-30')).toBe(false);
    expect(isCalendarDay('2026-1-5')).toBe(false);
    expect(isCalendarDay('2026-10-19')).toBe(true);
  });
});

describe('resolveWorkoutLogDay', () => {
  it('defaults to today', () => {
    expect(resolveWorkoutLogDay(undefined, TODAY)).toBe(TODAY);
  });

  it('allows today and the full back-date window', () => {
    expect(resolveWorkoutLogDay(TODAY, TODAY)).toBe(TODAY);
    expect(resolveWorkoutLogDay(addDays(TODAY, -WORKOUT_LOG_BACKDATE_DAYS), TODAY)).toBe(addDays(TODAY, -14));
  });

  it('rejects the future, too-old and malformed dates', () => {
    expect(() => resolveWorkoutLogDay(addDays(TODAY, 1), TODAY)).toThrow(/future/);
    expect(() => resolveWorkoutLogDay(addDays(TODAY, -15), TODAY)).toThrow(/14 days/);
    expect(() => resolveWorkoutLogDay('yesterday', TODAY)).toThrow(/valid date/);
    expect(() => resolveWorkoutLogDay('2026-02-30', TODAY)).toThrow(/valid date/);
  });
});

describe('plannedExercisesOn / focusOf', () => {
  it('returns the weekday exercises in order, deduplicated', () => {
    const dup = [...SCHEDULE, ex('a', 'MONDAY', { muscleGroup: 'Legs', sortOrder: 5 })];
    expect(plannedExercisesOn(dup, { startDate: '2026-09-01', endDate: null }, '2026-10-19').map((e) => e.exerciseId)).toEqual(['a', 'b']);
  });

  it('is empty before the plan starts and after it ends', () => {
    expect(plannedExercisesOn(SCHEDULE, { startDate: '2026-10-20', endDate: null }, '2026-10-19')).toEqual([]);
    expect(plannedExercisesOn(SCHEDULE, { startDate: '2026-09-01', endDate: '2026-10-10' }, '2026-10-19')).toEqual([]);
  });

  it('focus is the most common muscle group, null when none is set', () => {
    expect(focusOf([{ muscleGroup: 'Legs' }, { muscleGroup: 'Legs' }, { muscleGroup: 'Core' }])).toBe('Legs');
    expect(focusOf([{ muscleGroup: null }, { muscleGroup: ' ' }])).toBeNull();
  });
});

describe('day states', () => {
  it('walks REST / UPCOMING / TODAY / MISSED / DONE / PARTIAL / SKIPPED', () => {
    const t = buildWorkoutTracking(
      input({
        logs: [
          log('2026-10-19', 'a'),
          log('2026-10-19', 'b'), // Mon fully done
          log('2026-10-16', 'd'), // Fri partial (e missing)
        ],
      }),
    );
    expect(dayOf(t, '2026-10-19').state).toBe('DONE');
    expect(dayOf(t, '2026-10-20').state).toBe('REST'); // Tuesday has no exercises
    expect(dayOf(t, '2026-10-21').state).toBe('TODAY'); // Wednesday, nothing logged yet
    expect(dayOf(t, '2026-10-23').state).toBe('UPCOMING'); // Friday
    expect(dayOf(t, '2026-10-16').state).toBe('PARTIAL');
    expect(dayOf(t, '2026-10-14').state).toBe('MISSED'); // previous Wednesday
  });

  it('all-skipped is SKIPPED, a mix with one completed and all logged is DONE', () => {
    const t = buildWorkoutTracking(
      input({
        logs: [log('2026-10-19', 'a', 'SKIPPED'), log('2026-10-19', 'b', 'SKIPPED'), log('2026-10-16', 'd'), log('2026-10-16', 'e', 'SKIPPED')],
      }),
    );
    expect(dayOf(t, '2026-10-19').state).toBe('SKIPPED');
    expect(dayOf(t, '2026-10-16').state).toBe('DONE');
  });

  it('exposes per-exercise status, ids and targets for the day cards', () => {
    const t = buildWorkoutTracking(
      input({
        schedule: [ex('a', 'MONDAY', { sets: 4, reps: 10, restSeconds: 60 }), ex('b', 'MONDAY')],
        logs: [log('2026-10-19', 'a', 'COMPLETED', { setsDone: 4, repsDone: 10, weightKg: 40 })],
      }),
    );
    const mon = dayOf(t, '2026-10-19');
    expect(mon.exercises[0]).toMatchObject({ exerciseId: 'a', sets: 4, reps: 10, restSeconds: 60, status: 'COMPLETED', weightKg: 40 });
    expect(mon.exercises[0]?.logId).toBeTruthy();
    expect(mon.exercises[1]).toMatchObject({ exerciseId: 'b', status: 'PENDING', logId: null });
    expect(mon.percent).toBe(50);
    expect(mon.completedCount).toBe(1);
  });

  it('canLog is only true for planned days inside the back-date window', () => {
    const t = buildWorkoutTracking(input());
    expect(dayOf(t, TODAY).canLog).toBe(true);
    expect(dayOf(t, '2026-10-23').canLog).toBe(false); // future
    expect(dayOf(t, '2026-10-20').canLog).toBe(false); // rest day
    expect(dayOf(t, '2026-10-07').canLog).toBe(true); // exactly 14 days back (Wednesday)
    expect(t.windowStart).toBe('2026-10-07');
    // days start on the Monday of the window's week so weeks are whole
    expect(t.days[0]?.date).toBe('2026-10-05');
    expect(t.days.at(-1)?.date).toBe('2026-10-25');
  });

  it('days before the plan starts are OUTSIDE, not MISSED', () => {
    const t = buildWorkoutTracking(input({ assignment: { id: ASSIGN, startDate: '2026-10-15', endDate: null } }));
    expect(dayOf(t, '2026-10-12').state).toBe('OUTSIDE');
    expect(dayOf(t, '2026-10-12').plannedCount).toBe(0);
    expect(dayOf(t, '2026-10-16').state).toBe('MISSED');
  });

  it('ignores logs that belong to another assignment', () => {
    const t = buildWorkoutTracking(input({ logs: [log('2026-10-19', 'a', 'COMPLETED', { assignmentId: 'old' }), log('2026-10-19', 'b', 'COMPLETED', { assignmentId: 'old' })] }));
    expect(dayOf(t, '2026-10-19').state).toBe('MISSED');
  });

  it('attaches session metadata', () => {
    const t = buildWorkoutTracking(input({ sessions: [session('2026-10-19', { durationMin: 50, effort: 3 })] }));
    expect(dayOf(t, '2026-10-19').session).toEqual({ durationMin: 50, effort: 3, notes: null });
  });
});

describe('week summary', () => {
  it('counts planned / completed sessions and exercises for the current week', () => {
    const t = buildWorkoutTracking(input({ logs: [log('2026-10-19', 'a'), log('2026-10-19', 'b'), log('2026-10-21', 'c', 'SKIPPED')] }));
    expect(t.week).toMatchObject({
      start: '2026-10-19',
      end: '2026-10-25',
      plannedSessions: 3,
      completedSessions: 1,
      plannedExercises: 5,
      completedExercises: 2,
      skippedExercises: 1,
      completionPercent: 40,
    });
  });

  it('nextDay is today while today is unfinished, then the next planned day', () => {
    expect(buildWorkoutTracking(input()).nextDay).toMatchObject({ date: TODAY, isToday: true, label: 'Wednesday', focus: 'Back', plannedCount: 1 });
    const done = buildWorkoutTracking(input({ logs: [log(TODAY, 'c')] }));
    expect(done.nextDay).toMatchObject({ date: '2026-10-23', isToday: false, label: 'Friday', focus: 'Chest' });
  });

  it('nextDay rolls into next week when nothing is left', () => {
    const t = buildWorkoutTracking(input({ today: '2026-10-24', logs: [log('2026-10-23', 'd'), log('2026-10-23', 'e')] }));
    expect(t.nextDay).toMatchObject({ date: '2026-10-26', label: 'Monday' });
  });

  it('has no nextDay for an empty plan', () => {
    expect(buildWorkoutTracking(input({ schedule: [] })).nextDay).toBeNull();
  });
});

describe('streak', () => {
  it('counts consecutive planned days done, skipping rest days', () => {
    const logs = [
      log('2026-10-12', 'a'), log('2026-10-12', 'b'), // Mon
      log('2026-10-14', 'c'), // Wed
      log('2026-10-16', 'd'), log('2026-10-16', 'e'), // Fri
      log('2026-10-19', 'a'), log('2026-10-19', 'b'), // Mon
      log('2026-10-21', 'c'), // Wed (today)
    ];
    expect(buildWorkoutTracking(input({ logs })).streak).toBe(5);
  });

  it('an unfinished today does not break the streak', () => {
    const logs = [log('2026-10-16', 'd'), log('2026-10-16', 'e'), log('2026-10-19', 'a'), log('2026-10-19', 'b')];
    expect(buildWorkoutTracking(input({ logs })).streak).toBe(2);
  });

  it('a missed past planned day ends it', () => {
    const logs = [log('2026-10-12', 'a'), log('2026-10-12', 'b'), /* Wed 14 missed */ log('2026-10-16', 'd'), log('2026-10-16', 'e'), log('2026-10-19', 'a'), log('2026-10-19', 'b')];
    expect(buildWorkoutTracking(input({ logs })).streak).toBe(2);
  });

  it('is zero with nothing logged and a missed day behind us', () => {
    expect(buildWorkoutTracking(input()).streak).toBe(0);
  });
});

describe('consistency', () => {
  it('returns CONSISTENCY_WEEKS weeks oldest first, ending with the current week', () => {
    const t = buildWorkoutTracking(input());
    expect(t.consistency).toHaveLength(CONSISTENCY_WEEKS);
    expect(t.consistency.at(-1)).toMatchObject({ weekStart: '2026-10-19', isCurrent: true });
    expect(t.consistency[0]?.weekStart).toBe('2026-08-31');
  });

  it('percent is done / days already due (today only counts once done)', () => {
    // current week: Mon done, Wed (today) untouched -> 1 of 1 due
    const t = buildWorkoutTracking(input({ logs: [log('2026-10-19', 'a'), log('2026-10-19', 'b')] }));
    expect(t.consistency.at(-1)).toMatchObject({ plannedSessions: 3, completedSessions: 1, percent: 100 });
    // previous week: all three missed
    expect(t.consistency.at(-2)).toMatchObject({ plannedSessions: 3, completedSessions: 0, percent: 0 });
  });

  it('weeks before the plan started have no percent', () => {
    const t = buildWorkoutTracking(input({ assignment: { id: ASSIGN, startDate: '2026-10-12', endDate: null } }));
    expect(t.consistency.at(-3)?.percent).toBeNull();
    expect(t.consistency.at(-2)?.percent).toBe(0);
  });
});

describe('exercise / muscle stats and skips', () => {
  it('counts only due exercises over the last 28 days', () => {
    const t = buildWorkoutTracking(
      input({
        assignment: { id: ASSIGN, startDate: '2026-10-12', endDate: null },
        logs: [log('2026-10-12', 'a'), log('2026-10-12', 'b', 'SKIPPED'), log('2026-10-19', 'a', 'SKIPPED'), log('2026-10-19', 'b', 'SKIPPED')],
      }),
    );
    const b = t.exercises.find((e) => e.exerciseId === 'b')!;
    expect(b).toMatchObject({ planned: 2, completed: 0, skipped: 2 });
    const a = t.exercises.find((e) => e.exerciseId === 'a')!;
    expect(a).toMatchObject({ planned: 2, completed: 1, skipped: 1 });
    // c: Wed 10-14 missed (due, not logged), Wed 10-21 is today and untouched (not due)
    expect(t.exercises.find((e) => e.exerciseId === 'c')).toMatchObject({ planned: 1, completed: 0, skipped: 0 });
    expect(t.mostSkipped.map((e) => e.exerciseId)).toEqual(['b', 'a']);
    expect(t.muscleGroups.find((g) => g.name === 'Legs')).toMatchObject({ planned: 4, completed: 1, skipped: 3 });
  });

  it('mostSkipped is empty when nothing was skipped', () => {
    expect(buildWorkoutTracking(input({ logs: [log('2026-10-19', 'a')] })).mostSkipped).toEqual([]);
  });
});

describe('last 30 days, volume and personal bests', () => {
  it('minutes and volume are null when nothing carries them', () => {
    const t = buildWorkoutTracking(input({ logs: [log('2026-10-19', 'a')] }));
    expect(t.last30).toMatchObject({ minutes: null, volumeKg: null, avgEffort: null, exercisesCompleted: 1 });
  });

  it('sums session minutes (falling back to entry minutes), volume and average effort', () => {
    const t = buildWorkoutTracking(
      input({
        logs: [
          log('2026-10-19', 'a', 'COMPLETED', { setsDone: 4, repsDone: 10, weightKg: 20, durationMin: 5 }), // session below wins for this date
          log('2026-10-16', 'd', 'COMPLETED', { durationMin: 20 }), // no session -> entry minutes
          log('2026-10-16', 'e', 'COMPLETED', { setsDone: 3, repsDone: 10 }), // no weight -> not in volume
        ],
        sessions: [session('2026-10-19', { durationMin: 45, effort: 4 }), session('2026-10-14', { effort: 2 })],
      }),
    );
    expect(t.last30.minutes).toBe(65);
    expect(t.last30.volumeKg).toBe(800);
    expect(t.last30.avgEffort).toBe(3);
  });

  it('personal best is the heaviest weight; isNew only when it beat an earlier lower weight within 7 days', () => {
    const t = buildWorkoutTracking(
      input({
        weighted: [
          { exerciseId: 'a', exerciseName: 'Squat', date: '2026-09-20', weightKg: 60, repsDone: 5 },
          { exerciseId: 'a', exerciseName: 'Squat', date: '2026-10-20', weightKg: 70, repsDone: 3 },
          { exerciseId: 'd', exerciseName: 'Bench', date: '2026-10-20', weightKg: 40, repsDone: 8 }, // first ever -> not "new"
          { exerciseId: 'b', exerciseName: 'Lunge', date: '2026-09-01', weightKg: 30, repsDone: null },
        ],
      }),
    );
    expect(t.personalBests.find((p) => p.exerciseId === 'a')).toMatchObject({ weightKg: 70, repsDone: 3, isNew: true });
    expect(t.personalBests.find((p) => p.exerciseId === 'd')?.isNew).toBe(false);
    expect(t.personalBests.find((p) => p.exerciseId === 'b')?.isNew).toBe(false);
    expect(t.personalBests[0]?.exerciseId).not.toBe('b'); // newest first
  });
});

describe('insights', () => {
  it('asks for the first log when the member never logged anything', () => {
    const t = buildWorkoutTracking(input({ everLogged: false }));
    expect(t.insights).toHaveLength(1);
    expect(t.insights[0]).toMatchObject({ tone: 'tip', title: 'Log your first workout' });
    expect(t.insights[0]?.body).toContain('Today’s Back day');
  });

  it('first-log insight copes with no schedule', () => {
    const t = buildWorkoutTracking(input({ everLogged: false, schedule: [] }));
    expect(t.insights[0]?.body).toContain('When your plan has scheduled days');
  });

  it('warns about the most recent unfinished planned day with the next day to aim for', () => {
    // Monday partial -> "didn't finish"
    const t = buildWorkoutTracking(input({ today: '2026-10-21', logs: [log('2026-10-19', 'a')] }));
    expect(t.insights[0]).toMatchObject({ tone: 'warn', title: 'You didn’t finish Monday’s workout' });
    expect(t.insights[0]?.body).toContain('Today’s Back day');
    const missed = buildWorkoutTracking(input({ today: '2026-10-19', logs: [] })).insights.find((i) => i.tone === 'warn');
    expect(missed?.title).toBe('You missed Friday’s workout');
  });

  it('reports "X of Y planned sessions" with the next day, and "Week complete" when all are done', () => {
    const some = buildWorkoutTracking(input({ logs: [log('2026-10-19', 'a'), log('2026-10-19', 'b')] }));
    const week = some.insights.find((i) => i.title.includes('planned sessions done'))!;
    expect(week.title).toBe('1 of 3 planned sessions done this week');
    expect(week.body).toContain('Today’s Back day is next');

    const all = buildWorkoutTracking(
      input({
        today: '2026-10-25',
        logs: [log('2026-10-19', 'a'), log('2026-10-19', 'b'), log('2026-10-21', 'c'), log('2026-10-23', 'd'), log('2026-10-23', 'e')],
      }),
    );
    expect(all.insights.find((i) => i.tone === 'good' && i.title === 'Week complete')).toBeTruthy();
  });

  it('suggests a swap for an exercise skipped most of the time', () => {
    const t = buildWorkoutTracking(
      input({
        assignment: { id: ASSIGN, startDate: '2026-10-12', endDate: null },
        logs: [log('2026-10-12', 'a'), log('2026-10-12', 'b', 'SKIPPED'), log('2026-10-19', 'a'), log('2026-10-19', 'b', 'SKIPPED')],
      }),
    );
    const tip = t.insights.find((i) => i.title === 'You skip Ex b often');
    expect(tip).toBeTruthy();
    expect(tip?.body).toContain('2 of the last 2 times');
    expect(tip?.body).toContain('ask your trainer for a swap');
  });

  it('celebrates a new personal best and a streak of 3+', () => {
    const logs = [
      log('2026-10-12', 'a'), log('2026-10-12', 'b'),
      log('2026-10-14', 'c'),
      log('2026-10-16', 'd'), log('2026-10-16', 'e'),
      log('2026-10-19', 'a'), log('2026-10-19', 'b'),
    ];
    const t = buildWorkoutTracking(
      input({
        logs,
        weighted: [
          { exerciseId: 'a', exerciseName: 'Squat', date: '2026-10-12', weightKg: 50, repsDone: null },
          { exerciseId: 'a', exerciseName: 'Squat', date: '2026-10-19', weightKg: 55, repsDone: 5 },
        ],
      }),
    );
    expect(t.insights.find((i) => i.title === 'New personal best: Squat')?.body).toBe('55 kg x 5 reps on Monday. Great progress.');
    expect(t.insights.find((i) => i.title === '4-session streak')?.tone).toBe('good');
  });

  it('flags a consistency climb and a dip (needs 2+ weeks of data each side)', () => {
    // helper: complete every planned day of a week
    const weekLogs = (monday: string, doneDays: Array<[number, string[]]>) =>
      doneDays.flatMap(([offset, ids]) => ids.map((id) => log(addDays(monday, offset), id)));
    const full = (monday: string) => weekLogs(monday, [[0, ['a', 'b']], [2, ['c']], [4, ['d', 'e']]]);
    // earlier weeks (09-14, 09-21, 09-28) empty; recent (10-05, 10-12) full -> climb
    const up = buildWorkoutTracking(input({ today: '2026-10-21', logs: [...full('2026-10-05'), ...full('2026-10-12'), ...full('2026-09-28')] }));
    // recent 3 full weeks = 09-28, 10-05, 10-12 (100,100,100); earlier = 09-07, 09-14, 09-21 (0,0,0)
    expect(up.insights.find((i) => i.title === 'Your consistency is climbing')?.body).toContain('100%');
    const down = buildWorkoutTracking(input({ today: '2026-10-21', logs: [...full('2026-09-07'), ...full('2026-09-14'), ...full('2026-09-21')] }));
    expect(down.insights.find((i) => i.title === 'Your consistency dipped')?.tone).toBe('warn');
  });

  it('notes high effort, an ending plan, and never returns more than MAX_INSIGHTS ordered by priority', () => {
    const t = buildWorkoutTracking(
      input({
        assignment: { id: ASSIGN, startDate: '2026-10-12', endDate: '2026-10-24' },
        logs: [log('2026-10-12', 'a'), log('2026-10-12', 'b', 'SKIPPED'), log('2026-10-19', 'a'), log('2026-10-19', 'b', 'SKIPPED')],
        sessions: [session('2026-10-12', { effort: 5 }), session('2026-10-19', { effort: 5 }), session('2026-10-16', { effort: 4 })],
        weighted: [
          { exerciseId: 'a', exerciseName: 'Squat', date: '2026-10-12', weightKg: 50, repsDone: null },
          { exerciseId: 'a', exerciseName: 'Squat', date: '2026-10-20', weightKg: 60, repsDone: null },
        ],
      }),
    );
    expect(t.insights.length).toBeLessThanOrEqual(MAX_INSIGHTS);
    expect(t.insights).toHaveLength(MAX_INSIGHTS);
    const titles = t.insights.map((i) => i.title);
    expect(titles[0]).toContain('planned sessions done'); // priority 2
    expect(titles[1]).toBe('You skip Ex b often'); // 3
    expect(titles[2]).toBe('New personal best: Squat'); // 4
    expect(titles[3]).toBe('Your sessions feel tough lately'); // 7
    // plan-ending (priority 8) is cut by the cap
    expect(titles.some((x) => x.startsWith('Your plan ends'))).toBe(false);
  });

  it('effort tip appears when it makes the cut', () => {
    const t = buildWorkoutTracking(
      input({
        logs: [log('2026-10-19', 'a'), log('2026-10-19', 'b')],
        sessions: [session('2026-10-13', { effort: 5 }), session('2026-10-16', { effort: 5 }), session('2026-10-19', { effort: 4 })],
      }),
    );
    expect(t.insights.find((i) => i.title === 'Your sessions feel tough lately')?.body).toContain('4.7 out of 5');
  });

  it('plan ending soon is mentioned', () => {
    const t = buildWorkoutTracking(input({ assignment: { id: ASSIGN, startDate: '2026-09-01', endDate: '2026-10-24' }, logs: [log('2026-10-19', 'a'), log('2026-10-19', 'b')] }));
    expect(t.insights.find((i) => i.title === 'Your plan ends in 3 days')?.tone).toBe('tip');
  });

  it('uses plain wording without a muscle focus', () => {
    const t = buildWorkoutTracking(input({ schedule: [ex('a', 'MONDAY'), ex('c', 'WEDNESDAY')], everLogged: false }));
    expect(t.insights[0]?.body).toContain('Today’s workout');
  });
});

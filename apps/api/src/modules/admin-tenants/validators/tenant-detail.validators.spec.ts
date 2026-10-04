import { describe, expect, it } from 'vitest';

import {
  activityQuerySchema,
  limitsBodySchema,
  moduleKeyParamSchema,
  noteBodySchema,
  reportsQuerySchema,
  tagsBodySchema,
} from './tenant-detail.validators';

const msg = (r: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  r.error?.issues.map((i) => i.message).join(' | ') ?? '';

describe('notes validator', () => {
  it('trims and requires text', () => {
    expect(noteBodySchema.parse({ body: '  hi  ' }).body).toBe('hi');
    expect(noteBodySchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(msg(noteBodySchema.safeParse({ body: 'x'.repeat(2001) }))).toMatch(/2000/);
  });
});

describe('tags validator', () => {
  it('lowercases, dedupes, enforces slug/length/count', () => {
    expect(tagsBodySchema.parse({ tags: ['Key-Account', 'key-account', ' VIP '] }).tags).toEqual([
      'key-account',
      'vip',
    ]);
    expect(tagsBodySchema.safeParse({ tags: ['has space'] }).success).toBe(false);
    expect(tagsBodySchema.safeParse({ tags: ['-lead'] }).success).toBe(false);
    expect(tagsBodySchema.safeParse({ tags: ['a'.repeat(25)] }).success).toBe(false);
    expect(
      tagsBodySchema.safeParse({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success,
    ).toBe(false);
    expect(tagsBodySchema.parse({ tags: [] }).tags).toEqual([]);
  });
});

describe('limits validator', () => {
  it('accepts ints and null, rejects unknown keys/negatives/floats/empty', () => {
    expect(
      limitsBodySchema.parse({ overrides: { maxMembers: 800, maxBranches: null } }).overrides,
    ).toEqual({ maxMembers: 800, maxBranches: null });
    expect(msg(limitsBodySchema.safeParse({ overrides: { nope: 1 } }))).toMatch(/Unknown limit/);
    expect(limitsBodySchema.safeParse({ overrides: { maxMembers: -1 } }).success).toBe(false);
    expect(limitsBodySchema.safeParse({ overrides: { maxMembers: 1.5 } }).success).toBe(false);
    expect(limitsBodySchema.safeParse({ overrides: { maxMembers: 99999999 } }).success).toBe(false);
    expect(limitsBodySchema.safeParse({ overrides: {} }).success).toBe(false);
  });
});

describe('other validators', () => {
  it('reports query defaults and rejects bad range', () => {
    expect(reportsQuerySchema.parse({})).toEqual({ range: '30d', compare: true });
    expect(reportsQuerySchema.parse({ range: '12m', compare: 'false' }).compare).toBe(false);
    expect(msg(reportsQuerySchema.safeParse({ range: '5y' }))).toMatch(/range must be one of/);
  });
  it('module key param', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(moduleKeyParamSchema.safeParse({ tenantId: id, key: 'workout_plans' }).success).toBe(
      true,
    );
    expect(moduleKeyParamSchema.safeParse({ tenantId: id, key: 'Bad Key' }).success).toBe(false);
  });
  it('activity query parses dates and rejects inverted range', () => {
    const q = activityQuerySchema.parse({ from: '2026-09-01', to: '2026-10-01', page: '2' });
    expect(q.from).toBeInstanceOf(Date);
    expect(q.page).toBe(2);
    expect(activityQuerySchema.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success).toBe(
      false,
    );
    expect(activityQuerySchema.safeParse({ from: 'garbage' }).success).toBe(false);
  });
});

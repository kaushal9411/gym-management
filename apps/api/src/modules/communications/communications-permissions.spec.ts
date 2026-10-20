import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const permissionSets = vi.hoisted(() => new Map<string, string[]>());

vi.mock('../../infrastructure/cache/redis', () => ({
  cache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined) },
}));
vi.mock('../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../authentication/repositories/role.repository', () => ({
  RoleRepository: class {
    async getPermissionKeysForUser(_tenantId: string, userId: string): Promise<string[]> {
      return permissionSets.get(userId) ?? [];
    }
  },
}));

import { ForbiddenError, UnauthenticatedError } from '../../core/errors/app-error';
import { requirePermission } from '../authentication/middlewares/authorize.middleware';

const root = join(__dirname, '..', '..', '..');
const seed = readFileSync(join(root, 'prisma', 'seed.ts'), 'utf8');
const migration = readFileSync(join(root, 'prisma', 'migrations', '20261020100000_communications', 'migration.sql'), 'utf8');
const routes = readFileSync(join(__dirname, 'routes', 'communications.routes.ts'), 'utf8');

/** Slice of the ROLE_PERMISSIONS entry for one role. */
function roleBlock(role: string): string {
  const start = seed.indexOf(`  ${role}: [`);
  expect(start).toBeGreaterThan(-1);
  return seed.slice(start, seed.indexOf('\n  ],', start));
}

function run(userId: string | null, key: string): Promise<unknown> {
  const req = { auth: userId ? { sub: userId, permVer: 1 } : undefined, tenant: { id: 'tenant-1' } } as never;
  return new Promise((resolve) => {
    void requirePermission(key)(req, {} as never, (err?: unknown) => resolve(err));
  });
}

describe('notifications:send permission', () => {
  beforeEach(() => permissionSets.clear());

  it('a user without notifications:send gets 403 FORBIDDEN naming the permission', async () => {
    permissionSets.set('trainer', ['notifications:view', 'members:view']);
    const err = await run('trainer', 'notifications:send');
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).httpStatus).toBe(403);
    expect((err as ForbiddenError).message).toContain('notifications:send');
  });

  it('notifications:view alone does not grant sending, nor does notifications:manage', async () => {
    permissionSets.set('viewer', ['notifications:view']);
    permissionSets.set('manager-only', ['notifications:manage']);
    expect(await run('viewer', 'notifications:send')).toBeInstanceOf(ForbiddenError);
    expect(await run('manager-only', 'notifications:send')).toBeInstanceOf(ForbiddenError);
  });

  it('a user holding the key passes', async () => {
    permissionSets.set('owner', ['notifications:send']);
    expect(await run('owner', 'notifications:send')).toBeUndefined();
  });

  it('no token at all is 401, not 403', async () => {
    expect(await run(null, 'notifications:send')).toBeInstanceOf(UnauthenticatedError);
  });
});

describe('catalog and default grants', () => {
  it('the key is in the seed catalogue and the backfill migration', () => {
    expect(seed).toContain("key: 'notifications:send'");
    expect(migration).toContain("'notifications:send'");
  });

  it('MANAGER gets it (like notifications:manage), TRAINER and RECEPTIONIST do not, OWNER via the wildcard', () => {
    expect(roleBlock('MANAGER')).toContain("'notifications:send'");
    expect(roleBlock('MANAGER')).toContain("'notifications:manage'");
    expect(roleBlock('TRAINER')).not.toContain("'notifications:send'");
    expect(roleBlock('RECEPTIONIST')).not.toContain("'notifications:send'");
    expect(seed).toMatch(/OWNER: '\*'/);
  });

  it('existing DBs get it: idempotent insert for the same system roles + a permission-version bump that invalidates the cache', () => {
    expect(migration).toMatch(/ON CONFLICT \("key"\) DO NOTHING/);
    expect(migration).toMatch(/ON CONFLICT DO NOTHING/);
    expect(migration).toContain(`r."name" IN ('OWNER', 'MANAGER')`);
    expect(migration).toMatch(/UPDATE "users" SET "permission_version" = "permission_version" \+ 1/);
    expect(migration).not.toMatch(/'TRAINER'|'RECEPTIONIST'/);
  });
});

describe('route gating', () => {
  it('every route is behind authentication and the notifications module flag', () => {
    expect(routes).toMatch(/communicationsRouter\.use\(authenticateMiddleware\)/);
    expect(routes).toMatch(/communicationsRouter\.use\(requireModuleEnabled\('notifications'\)\)/);
  });

  it('sending / campaign mutations / audience / test-send need notifications:send', () => {
    const rules: Array<[RegExp, string]> = [
      [/post\('\/audience\/preview',\s*requirePermission\('notifications:send'\)/, 'preview'],
      [/get\('\/audience\/members',\s*requirePermission\('notifications:send'\)/, 'picker'],
      [/post\('\/campaigns',\s*requirePermission\('notifications:send'\)/, 'create'],
      [/patch\('\/campaigns\/:id',\s*requirePermission\('notifications:send'\)/, 'update'],
      [/post\('\/campaigns\/:id\/send',\s*requirePermission\('notifications:send'\)/, 'send'],
      [/post\('\/campaigns\/:id\/cancel',\s*requirePermission\('notifications:send'\)/, 'cancel'],
      [/post\('\/campaigns\/:id\/retry-failed',\s*requirePermission\('notifications:send'\)/, 'retry'],
      [/post\('\/test-send',\s*requirePermission\('notifications:send'\)/, 'test-send'],
    ];
    for (const [re, label] of rules) expect(routes, label).toMatch(re);
  });

  it('history / overview / automation reads need notifications:view; automation writes keep notifications:manage', () => {
    const rules: Array<[RegExp, string]> = [
      [/get\('\/overview',\s*requirePermission\('notifications:view'\)/, 'overview'],
      [/get\('\/campaigns',\s*requirePermission\('notifications:view'\)/, 'list'],
      [/get\('\/campaigns\/:id',\s*requirePermission\('notifications:view'\)/, 'detail'],
      [/get\('\/campaigns\/:id\/recipients',\s*requirePermission\('notifications:view'\)/, 'recipients'],
      [/get\('\/automations',\s*requirePermission\('notifications:view'\)/, 'automations'],
      [/put\('\/automations\/:key',\s*requirePermission\('notifications:manage'\)/, 'put automation'],
      [/post\('\/automations\/:key\/test',\s*requirePermission\('notifications:manage'\)/, 'test automation'],
    ];
    for (const [re, label] of rules) expect(routes, label).toMatch(re);
  });

  it('every mutating route has a rate limiter and a validate() call', () => {
    const mutating = routes.split('\n').filter((l) => /^communicationsRouter\.(post|put|patch|delete)\(/.test(l));
    expect(mutating.length).toBeGreaterThanOrEqual(9);
    for (const line of mutating) {
      expect(line, line).toMatch(/Limiter\(\)/);
      expect(line, line).toMatch(/validate\(/);
    }
  });
});

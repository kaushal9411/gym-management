import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const seed = readFileSync(join(root, 'prisma', 'seed.ts'), 'utf8');
const migration = readFileSync(join(root, 'prisma', 'migrations', '20261122100000_hr_module', 'migration.sql'), 'utf8');
const read = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8');
const selfRoutes = read('routes', 'hr-self.routes.ts');
const adminRoutes = read('routes', 'hr-admin.routes.ts');
const payrollRoutes = read('routes', 'hr-payroll.routes.ts');
const mainRoutes = read('routes', 'hr.routes.ts');
const selfController = read('controllers', 'hr-self.controller.ts');
const validators = read('validators', 'hr.validators.ts');

const ALL = ['hr:view', 'hr:attendance_manage', 'hr:leave_manage', 'hr:payroll_manage', 'hr:settings_manage', 'hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'];
const SELF = ['hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'];

function roleBlock(role: string): string {
  const start = seed.indexOf(`  ${role}: [`);
  expect(start).toBeGreaterThan(-1);
  return seed.slice(start, seed.indexOf('\n  ],', start));
}
const hrKeysIn = (block: string): string[] => ALL.filter((k) => block.includes(`'${k}'`));

describe('HR permission catalogue + default grants', () => {
  it('registers every key in the seed catalogue and the backfill migration', () => {
    for (const k of ALL) {
      expect(seed).toContain(`key: '${k}'`);
      expect(migration).toContain(`'${k}'`);
    }
  });

  it('MANAGER gets everything except payroll; TRAINER and RECEPTIONIST get the self keys only; OWNER via wildcard', () => {
    expect(hrKeysIn(roleBlock('MANAGER')).sort()).toEqual(ALL.filter((k) => k !== 'hr:payroll_manage').sort());
    expect(hrKeysIn(roleBlock('TRAINER')).sort()).toEqual([...SELF].sort());
    expect(hrKeysIn(roleBlock('RECEPTIONIST')).sort()).toEqual([...SELF].sort());
    expect(seed).toMatch(/OWNER: '\*'/);
  });

  it('the migration grants match the seed and are idempotent', () => {
    expect(migration).toMatch(/ON CONFLICT \("key"\) DO NOTHING/);
    expect(migration).toMatch(/ON CONFLICT DO NOTHING/);
    expect(migration).toContain("r.\"name\" = 'OWNER' AND p.\"key\" LIKE 'hr:%'");
    expect(migration).toMatch(/r\."name" IN \('TRAINER', 'RECEPTIONIST'\) AND p\."key" IN \('hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'\)/);
  });

  it('every HR table is row-level-secured by tenant', () => {
    const tables = [...migration.matchAll(/CREATE TABLE "(hr_[a-z_]+)"/g)].map((m) => m[1]);
    expect(tables.length).toBe(11);
    for (const t of tables) {
      expect(migration).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
      expect(migration).toContain(`CREATE POLICY tenant_isolation ON "${t}"`);
    }
  });
});

describe('route gating', () => {
  const routeLines = (src: string) => src.split('\n').filter((l) => /^hr(Self|Admin|Payroll)Router\.(get|post|put|patch|delete)\(/.test(l));

  it('every route declares a permission', () => {
    for (const l of [...routeLines(selfRoutes), ...routeLines(adminRoutes), ...routeLines(payrollRoutes)]) expect(l).toMatch(/requirePermission\('hr:[a-z_]+'\)/);
  });

  it('every /hr/me route is gated by a self permission and nothing else', () => {
    const lines = routeLines(selfRoutes);
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) {
      expect(l).toContain("'/me/");
      expect(l).toMatch(/requirePermission\('hr:self_(attendance|leave|payslip)'\)/);
    }
  });

  it('no admin route sits behind a self permission, and all payroll routes need hr:payroll_manage', () => {
    for (const l of routeLines(adminRoutes)) expect(l).not.toMatch(/hr:self_/);
    for (const l of routeLines(payrollRoutes)) expect(l).toContain("requirePermission('hr:payroll_manage')");
  });

  it('mutations are behind the matching management permission', () => {
    const rules: Array<[RegExp, string]> = [
      [/put\('\/attendance', requirePermission\('hr:attendance_manage'\)/, 'mark'],
      [/post\('\/attendance\/bulk', requirePermission\('hr:attendance_manage'\)/, 'bulk'],
      [/delete\('\/attendance', requirePermission\('hr:attendance_manage'\)/, 'clear'],
      [/post\('\/leaves\/:id\/approve', requirePermission\('hr:leave_manage'\)/, 'approve'],
      [/post\('\/leaves\/:id\/reject', requirePermission\('hr:leave_manage'\)/, 'reject'],
      [/post\('\/leaves', requirePermission\('hr:leave_manage'\)/, 'apply on behalf'],
      [/put\('\/policy', requirePermission\('hr:settings_manage'\)/, 'policy'],
      [/post\('\/shifts', requirePermission\('hr:settings_manage'\)/, 'shift'],
      [/put\('\/employees\/:userId\/pay-structure', requirePermission\('hr:payroll_manage'\)/, 'pay structure'],
    ];
    for (const [re, name] of rules) expect(adminRoutes, name).toMatch(re);
  });

  it('the router authenticates once, then mounts /me first so a parameterised path can never shadow it', () => {
    expect(mainRoutes.indexOf('authenticateMiddleware')).toBeGreaterThan(-1);
    expect(mainRoutes.indexOf('hrSelfRouter)')).toBeLessThan(mainRoutes.indexOf('hrAdminRouter)'));
  });
});

describe('/hr/me is always the caller', () => {
  it('the self controller never reads a user id from the client', () => {
    expect(selfController).not.toMatch(/req\.(params|body|query)\.userId/);
    expect(selfController).not.toMatch(/userId\s*[:=]\s*req\.(params|body|query)/);
    expect(selfController).toContain('req.auth!.sub');
  });

  it('the self-service validators do not accept a userId', () => {
    const selfSection = validators.slice(validators.indexOf('// ── self-service'), validators.indexOf('// ── overview / employees'));
    expect(selfSection).not.toMatch(/userId/);
  });
});

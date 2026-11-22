import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The `hr` plan module / platform feature flag: seed catalogue + plan tiers, the grandfathering migration, and the
 * gate at the `/hr` mount. The runtime gate behaviour (403 off / pass on, per sub-router) is covered in
 * `tenants/middleware/module-gate.routes.spec.ts`; this file pins the data + wiring that spec cannot see.
 */
const root = join(__dirname, '..', '..', '..');
const seed = readFileSync(join(root, 'prisma', 'seed.ts'), 'utf8');
const migration = readFileSync(join(root, 'prisma', 'migrations', '20261123100000_hr_feature_flag', 'migration.sql'), 'utf8');
const mainRoutes = readFileSync(join(__dirname, 'routes', 'hr.routes.ts'), 'utf8');

const between = (src: string, from: string, to: string): string => {
  const start = src.indexOf(from);
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf(to, start));
};

describe('hr feature flag - seed', () => {
  it('is in the plan feature catalogue and the platform FEATURE_FLAGS (operations)', () => {
    expect(between(seed, 'function featureChecklist', '\nconst STARTER_FEATURES')).toContain("{ key: 'hr', label: 'HR management' }");
    expect(between(seed, 'const FEATURE_FLAGS', '];')).toContain("{ key: 'hr', label: 'HR management', category: 'operations' }");
  });

  it('is granted to Professional (and so Enterprise, which spreads it) but NOT Starter', () => {
    expect(between(seed, 'const STARTER_FEATURES', '};')).not.toMatch(/\bhr:/);
    expect(between(seed, 'const PROFESSIONAL_FEATURES', '};')).toMatch(/\bhr: true/);
    expect(between(seed, 'const ENTERPRISE_FEATURES', '};')).toContain('...PROFESSIONAL_FEATURES');
    expect(between(seed, 'const ENTERPRISE_FEATURES', '};')).not.toMatch(/\bhr: false/);
  });
});

describe('hr feature flag - migration 20261123100000_hr_feature_flag', () => {
  it('inserts the platform flag enabled, idempotently', () => {
    expect(migration).toMatch(/INSERT INTO "feature_flags"[\s\S]*'hr', 'HR management', 'operations', true[\s\S]*ON CONFLICT \("key"\) DO NOTHING/);
  });

  it('adds the plan feature per plan: Starter off, every other plan on, no duplicates', () => {
    expect(migration).toMatch(/\(p\."slug" <> 'starter'\)/);
    expect(migration).toMatch(/INSERT INTO "subscription_features"[\s\S]*ON CONFLICT \("plan_id", "key"\) DO NOTHING/);
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM "subscription_features" x');
  });

  it('grandfathers EVERY existing tenant: enabled, no admin override, only where the row is missing', () => {
    expect(migration).toMatch(/FOR t IN SELECT "id" FROM "tenants"/);
    expect(migration).toMatch(/VALUES \(gen_random_uuid\(\), t\."id", 'hr', true, false,/);
    expect(migration).toContain('ON CONFLICT ("tenant_id", "key") DO NOTHING');
    expect(migration).toContain("set_config('app.tenant_id'");
  });

  it('is data-only (no DDL)', () => {
    expect(migration).not.toMatch(/\b(CREATE|ALTER|DROP)\s+(TABLE|COLUMN|INDEX|TYPE)\b/i);
  });
});

describe('hr feature flag - gate wiring', () => {
  it('gates the whole /hr mount right after authentication and BEFORE every sub-router', () => {
    const auth = mainRoutes.indexOf('hrRouter.use(authenticateMiddleware)');
    const gate = mainRoutes.indexOf("hrRouter.use(requireModuleEnabled('hr'))");
    expect(auth).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(auth);
    for (const sub of ['hrSelfRouter', 'hrPayrollRouter', 'hrAdminRouter']) {
      expect(mainRoutes.indexOf(`hrRouter.use(${sub})`)).toBeGreaterThan(gate);
    }
  });

  it('has no ungated producers: nothing outside modules/hr imports the HR notification/payroll services', () => {
    const files = ['scheduler/handlers/attendance.handlers.ts', 'scheduler/constants/job-registry.ts', 'communications/services/automation-sweeps.service.ts'];
    for (const f of files) {
      const src = readFileSync(join(__dirname, '..', f), 'utf8');
      expect(src).not.toMatch(/modules\/hr|\.\.\/hr\/|hr-notification|hrNotification/);
    }
  });
});

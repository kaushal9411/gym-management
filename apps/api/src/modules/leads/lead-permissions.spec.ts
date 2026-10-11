import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const seed = readFileSync(join(root, 'prisma', 'seed.ts'), 'utf8');
const migration = readFileSync(join(root, 'prisma', 'migrations', '20261011151200_leads_permissions', 'migration.sql'), 'utf8');
const KEYS = ['leads:view', 'leads:create', 'leads:update', 'leads:delete', 'leads:convert', 'leads:assign', 'leads:export'];
const routes = readFileSync(join(__dirname, 'routes', 'lead.routes.ts'), 'utf8');

/** Slice of the ROLE_PERMISSIONS entry for one role (from `  ROLE: [` to its closing `  ],`). */
function roleBlock(role: string): string {
  const start = seed.indexOf(`  ${role}: [`);
  expect(start).toBeGreaterThan(-1);
  return seed.slice(start, seed.indexOf('\n  ],', start));
}
const leadKeysIn = (block: string): string[] => KEYS.filter((k) => block.includes(`'${k}'`));

describe('leads permission catalogue + grants', () => {
  it('registers all seven keys in the seed catalogue and the backfill migration', () => {
    for (const k of KEYS) {
      expect(seed).toContain(`key: '${k}'`);
      expect(migration).toContain(`'${k}'`);
    }
  });
  it('MANAGER gets all, RECEPTIONIST view/create/update/convert only, TRAINER none, OWNER via wildcard', () => {
    expect(leadKeysIn(roleBlock('MANAGER')).sort()).toEqual([...KEYS].sort());
    expect(leadKeysIn(roleBlock('RECEPTIONIST')).sort()).toEqual(['leads:convert', 'leads:create', 'leads:update', 'leads:view']);
    expect(leadKeysIn(roleBlock('TRAINER'))).toEqual([]);
    expect(seed).toMatch(/OWNER: '\*'/);
  });
  it('backfill migration grants match the seed (idempotent inserts)', () => {
    expect(migration).toMatch(/ON CONFLICT \("key"\) DO NOTHING/);
    expect(migration).toMatch(/ON CONFLICT DO NOTHING/);
    expect(migration).toContain("r.\"name\" IN ('OWNER', 'MANAGER')");
    expect(migration).toContain("p.\"key\" IN ('leads:view', 'leads:create', 'leads:update', 'leads:convert')");
    expect(migration).not.toMatch(/TRAINER/);
  });
  it('every mutating route is behind the matching permission', () => {
    const rules: Array<[RegExp, string]> = [
      [/post\('\/',\s*requirePermission\('leads:create'\)/, 'create'],
      [/patch\('\/:id',\s*requirePermission\('leads:update'\)/, 'update'],
      [/delete\('\/:id',\s*requirePermission\('leads:delete'\)/, 'delete'],
      [/patch\('\/:id\/status',\s*requirePermission\('leads:update'\)/, 'status'],
      [/patch\('\/:id\/assign',\s*requirePermission\('leads:assign'\)/, 'assign'],
      [/post\('\/:id\/activities',\s*requirePermission\('leads:update'\)/, 'activity'],
      [/post\('\/:id\/convert',\s*requirePermission\('leads:convert'\)/, 'convert'],
      [/get\('\/export',\s*requirePermission\('leads:export'\)/, 'export'],
    ];
    for (const [re, label] of rules) expect(routes, label).toMatch(re);
  });
});

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** The 12 platform flags (Super Admin > Feature Flags; 11 seeded + `hr`), see apps/api prisma/seed.ts FEATURE_FLAGS. */
export const PLATFORM_FLAGS = [
  'ai_coach',
  'notifications',
  'support_tickets',
  'expenses',
  'income',
  'payments',
  'reports',
  'attendance',
  'diet_plans',
  'live_classes',
  'workout_plans',
  'hr',
] as const;
export type PlatformFlag = (typeof PLATFORM_FLAGS)[number];

/** Plan modules that are NOT platform flags — always present in `featureFlags` for a plan that includes them. */
export const NON_PLATFORM_PLAN_MODULES = ['members', 'staff', 'branches', 'membership_plans', 'analytics', 'dashboard'];

export const SRC = join(__dirname, '..', '..', 'src');

/** Reads a file under src/ (returns '' if missing so "is this guarded" checks just fail instead of throwing). */
export function readSrc(rel: string): string {
  const full = join(SRC, rel);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/** True when the source references the tenant's feature flags in any of the ways the codebase supports. */
export function referencesFeatureFlags(source: string): boolean {
  return /featureFlags|RequireFeature|useFeature|hasFeature/.test(source);
}

/** Tenant `featureFlags` as the resolve endpoint would deliver it with exactly `disabled` switched off platform-wide. */
export function flagsWithout(...disabled: string[]): string[] {
  return [...PLATFORM_FLAGS, ...NON_PLATFORM_PLAN_MODULES].filter((f) => !disabled.includes(f));
}

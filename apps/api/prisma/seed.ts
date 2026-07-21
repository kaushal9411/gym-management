/**
 * Seeds the global, tenant-agnostic RBAC/PBAC catalog:
 *   • 6 system roles (tenantId = null, isSystem = true)
 *   • a representative permission catalog ("resource:action" keys) spanning
 *     modules that don't exist yet — permissions are just data, so seeding
 *     the keys now costs nothing and means those future modules only need
 *     to add routes/services, not touch RBAC plumbing.
 *   • role → permission mappings for each system role
 *
 * Idempotent — safe to re-run (upsert throughout).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from '@node-rs/bcrypt';

const prisma = new PrismaClient();

// The seed script's own tsconfig scopes `rootDir` to `prisma/`, so it can't
// import from `src/core/security/password.service.ts` — hashing is inlined
// here instead, using the same @node-rs/bcrypt + cost factor the app itself uses.
const BCRYPT_SALT_ROUNDS = 10;
async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

const PERMISSIONS: Array<{ key: string; description: string }> = [
  // Identity & access
  { key: 'users:read', description: 'View staff accounts and their access' },
  { key: 'users:invite', description: 'Invite a new staff member' },
  { key: 'users:manage', description: 'Update, suspend, or deactivate staff accounts' },
  { key: 'users:export', description: 'Export the staff list' },
  { key: 'roles:read', description: 'View roles and their permissions' },
  { key: 'roles:manage-custom', description: 'Create and edit custom tenant roles (Enterprise)' },
  { key: 'permissions:read', description: 'View the permission registry and matrix' },
  { key: 'audit:read', description: 'View the audit log' },

  // Gym operations
  { key: 'branches:manage', description: 'Create, update, or archive branches' },
  { key: 'branches:read', description: 'View branch details' },
  { key: 'members:manage', description: 'Create, update, or archive member records' },
  { key: 'members:read', description: 'View member records' },
  { key: 'memberships:manage', description: 'Manage membership plans and enrollments' },
  { key: 'attendance:create', description: 'Check members and staff in/out' },
  { key: 'attendance:read', description: 'View attendance history' },
  { key: 'classes:manage', description: 'Create and schedule classes' },
  { key: 'classes:read', description: 'View class schedules' },
  { key: 'bookings:create', description: 'Book a class or session' },
  { key: 'bookings:read', description: 'View bookings' },
  { key: 'trainers:manage', description: 'Manage trainer profiles and assignments' },
  { key: 'workout-plans:manage', description: 'Create and assign workout plans' },
  { key: 'diet-plans:manage', description: 'Create and assign diet plans' },

  // Billing & reporting
  { key: 'payments:create', description: 'Record a payment' },
  { key: 'payments:read', description: 'View payment history' },
  { key: 'payments:refund', description: 'Issue a refund' },
  { key: 'reports:read', description: 'View operational reports' },
  { key: 'reports:view-financial', description: 'View revenue and financial reports' },
  { key: 'billing:manage', description: "Manage the gym's FitCloud subscription, plan, and billing address" },
  { key: 'billing:read', description: "View the gym's FitCloud invoices and subscription details" },

  // Communication & self-service
  { key: 'notifications:manage', description: 'Manage notification templates and campaigns' },
  { key: 'chat:use', description: 'Send and receive chat messages' },
  { key: 'settings:read', description: "View the gym's profile, branding, business and invoice settings" },
  { key: 'settings:manage', description: 'Manage branding, timezone, currency, tax settings' },
  { key: 'profile:read', description: "Read one's own profile" },
  { key: 'profile:update', description: "Update one's own profile" },

  // Staff Management (Prompt 13) — Manager/Trainer/Receptionist only, distinct
  // from the generic `users:*` IAM keys which cover every account type.
  { key: 'staff:view', description: 'View the staff list and staff profiles' },
  { key: 'staff:create', description: 'Add a new staff member' },
  { key: 'staff:update', description: "Edit a staff member's profile/employment info, or trigger a password reset" },
  { key: 'staff:delete', description: 'Soft-delete a staff member' },
  { key: 'staff:restore', description: 'Restore a soft-deleted staff member' },
  { key: 'staff:activate', description: 'Activate, deactivate, or suspend a staff account' },
  { key: 'staff:invite', description: 'Send or resend a staff activation invitation' },
  { key: 'staff:assign-branch', description: "Manage a staff member's branch assignments" },
  { key: 'staff:assign-role', description: "Change a staff member's role" },

  // Member Management (Prompt 14) — granular keys distinct from the
  // pre-existing `members:read`/`members:manage` speculative catalog entries.
  { key: 'members:view', description: 'View the member list and member profiles' },
  { key: 'members:create', description: 'Add a new member' },
  { key: 'members:update', description: "Edit a member's profile, address, or medical info" },
  { key: 'members:delete', description: 'Soft-delete a member' },
  { key: 'members:restore', description: 'Restore a soft-deleted member' },
  { key: 'members:import', description: 'Bulk-import members from CSV' },
  { key: 'members:export', description: 'Export the member list as CSV' },
  { key: 'members:assign-trainer', description: "Assign or change a member's trainer" },
  { key: 'members:assign-membership', description: "Assign, renew, upgrade, freeze, or unfreeze a member's membership" },

  // Membership Plans (Prompt 15) — the plan catalog itself, distinct from
  // `members:assign-membership` (acting on ONE member's subscription) and
  // from the pre-existing speculative `memberships:manage` catalog entry.
  { key: 'memberships:view', description: 'View the membership plan catalog' },
  { key: 'memberships:create', description: 'Create a membership plan' },
  { key: 'memberships:update', description: 'Edit, duplicate, activate, or deactivate a membership plan' },
  { key: 'memberships:delete', description: 'Soft-delete a membership plan' },
  { key: 'memberships:restore', description: 'Restore a soft-deleted membership plan' },
  { key: 'memberships:assign', description: "Assign a membership plan to a member" },
  { key: 'memberships:renew', description: "Renew or extend a member's membership" },
  { key: 'memberships:upgrade', description: "Upgrade, downgrade, or cancel a member's membership" },
  { key: 'memberships:freeze', description: "Freeze or resume a member's membership" },

  // Attendance Management (Prompt 16) — granular keys distinct from the
  // pre-existing speculative `attendance:create`/`attendance:read` catalog
  // entries (left seeded but unused, same precedent as Membership Plans
  // superseding the old blanket `memberships:manage`).
  { key: 'attendance:view', description: "View attendance records, history, and the dashboard summary" },
  { key: 'attendance:checkin', description: 'Check a member in (QR, manual, or a future device method)' },
  { key: 'attendance:checkout', description: 'Check a member out' },
  { key: 'attendance:update', description: 'Correct an attendance record (times, notes, status)' },
  { key: 'attendance:delete', description: 'Soft-delete an attendance record' },
  { key: 'attendance:export', description: 'Export attendance history as CSV/Excel' },
];

const ROLE_PERMISSIONS: Record<string, string[] | '*'> = {
  SUPER_ADMIN: '*',
  OWNER: '*',
  MANAGER: [
    'users:read', 'users:invite', 'users:manage', 'users:export',
    'roles:read', 'permissions:read', 'audit:read',
    'branches:manage', 'branches:read',
    'members:manage', 'members:read',
    'memberships:manage',
    'attendance:create', 'attendance:read',
    'classes:manage', 'classes:read', 'bookings:create', 'bookings:read',
    'trainers:manage', 'workout-plans:manage', 'diet-plans:manage',
    'payments:create', 'payments:read', 'payments:refund',
    'reports:read', 'reports:view-financial',
    'notifications:manage', 'chat:use', 'settings:read', 'settings:manage',
    'billing:manage', 'billing:read',
    'staff:view', 'staff:create', 'staff:update', 'staff:delete', 'staff:restore',
    'staff:activate', 'staff:invite', 'staff:assign-branch', 'staff:assign-role',
    'members:view', 'members:create', 'members:update', 'members:delete', 'members:restore',
    'members:import', 'members:export', 'members:assign-trainer', 'members:assign-membership',
    'memberships:view', 'memberships:create', 'memberships:update', 'memberships:delete', 'memberships:restore',
    'memberships:assign', 'memberships:renew', 'memberships:upgrade', 'memberships:freeze',
    'attendance:view', 'attendance:checkin', 'attendance:checkout', 'attendance:update', 'attendance:delete', 'attendance:export',
  ],
  TRAINER: [
    'members:read', 'attendance:create', 'attendance:read',
    'classes:read', 'bookings:read',
    'workout-plans:manage', 'diet-plans:manage', 'chat:use',
    'profile:read', 'profile:update',
    'members:view',
    'memberships:view',
    // Trainers can check members in/out for sessions, but not correct/delete/export records.
    'attendance:view', 'attendance:checkin', 'attendance:checkout',
  ],
  RECEPTIONIST: [
    'members:manage', 'members:read',
    'attendance:create', 'attendance:read',
    'memberships:manage', 'classes:read', 'bookings:create', 'bookings:read',
    'payments:create', 'payments:read', 'chat:use',
    'profile:read', 'profile:update',
    'members:view', 'members:create', 'members:update', 'members:import', 'members:export',
    'members:assign-membership',
    // Front-desk operations only — plan CATALOG changes (create/update/delete/restore)
    // stay a Manager decision, a deliberate tightening vs the old blanket `memberships:manage`.
    'memberships:view', 'memberships:assign', 'memberships:renew', 'memberships:upgrade', 'memberships:freeze',
    // Front-desk check-in/out + export, same tightening as above — record
    // correction/deletion stays a Manager decision.
    'attendance:view', 'attendance:checkin', 'attendance:checkout', 'attendance:export',
  ],
  MEMBER: ['profile:read', 'profile:update', 'bookings:create', 'bookings:read', 'payments:read', 'chat:use'],
};

interface PlanFeatureSeed {
  key: string;
  label: string;
  included: boolean;
}

interface PlanSeed {
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  maxBranches: number;
  maxManagers: number;
  maxTrainers: number;
  maxReceptionists: number;
  maxStaff: number;
  maxMembers: number;
  maxStorageMb: number;
  sortOrder: number;
  features: PlanFeatureSeed[];
}

/**
 * The full module/feature-flag catalog (Prompt 8) — same 25 keys across
 * every plan, `included` varies by tier. The four "Future Ready" entries
 * are architecture-only (no module exists yet behind them) and stay
 * `included: false` for every plan until they're actually built.
 */
function featureChecklist(included: Partial<Record<string, boolean>>): PlanFeatureSeed[] {
  const catalog: Array<{ key: string; label: string }> = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'members', label: 'Member management' },
    { key: 'staff', label: 'Staff management' },
    { key: 'branches', label: 'Branch management' },
    { key: 'attendance', label: 'Attendance tracking' },
    { key: 'workout_plans', label: 'Workout plans' },
    { key: 'diet_plans', label: 'Diet plans' },
    { key: 'membership_plans', label: 'Membership plans & billing' },
    { key: 'payments', label: 'Payments' },
    { key: 'income', label: 'Income tracking' },
    { key: 'expenses', label: 'Expense tracking' },
    { key: 'reports', label: 'Reports' },
    { key: 'analytics', label: 'Advanced analytics' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'chat', label: 'In-app chat' },
    { key: 'support_tickets', label: 'Support tickets' },
    { key: 'email_templates', label: 'Custom email templates' },
    { key: 'sms_templates', label: 'Custom SMS templates' },
    { key: 'api_access', label: 'API access' },
    { key: 'white_label', label: 'White-label branding' },
    { key: 'custom_domain', label: 'Custom domain' },
    { key: 'video_training', label: 'Video training (coming soon)' },
    { key: 'live_classes', label: 'Live classes (coming soon)' },
    { key: 'ai_coach', label: 'AI coach (coming soon)' },
    { key: 'marketplace', label: 'Marketplace (coming soon)' },
  ];
  return catalog.map((f) => ({ ...f, included: included[f.key] ?? false }));
}

const STARTER_FEATURES = {
  dashboard: true, members: true, branches: true, staff: true,
  attendance: true, membership_plans: true, payments: true,
};
const PROFESSIONAL_FEATURES = {
  ...STARTER_FEATURES,
  workout_plans: true, diet_plans: true, income: true, expenses: true,
  reports: true, notifications: true, chat: true,
  email_templates: true, sms_templates: true,
};
const ENTERPRISE_FEATURES = {
  ...PROFESSIONAL_FEATURES,
  analytics: true, support_tickets: true, api_access: true,
  white_label: true, custom_domain: true,
};

interface TaxRuleSeed {
  countryCode: string;
  stateCode: string | null;
  label: string;
  ratePercent: number;
}

/** A handful of representative rates — a real deployment would load a fuller table per jurisdiction. */
const TAX_RULES: TaxRuleSeed[] = [
  { countryCode: 'IN', stateCode: null, label: 'GST', ratePercent: 18 },
  { countryCode: 'GB', stateCode: null, label: 'VAT', ratePercent: 20 },
  { countryCode: 'AE', stateCode: null, label: 'VAT', ratePercent: 5 },
  { countryCode: 'CA', stateCode: null, label: 'GST', ratePercent: 5 },
  { countryCode: 'US', stateCode: null, label: 'Sales tax', ratePercent: 0 },
];

const SUBSCRIPTION_PLANS: PlanSeed[] = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'For single-location gyms getting started with digital management.',
    priceMonthly: 29,
    priceYearly: 290,
    trialDays: 14,
    maxBranches: 1,
    maxManagers: 2,
    maxTrainers: 5,
    maxReceptionists: 2,
    maxStaff: 10,
    maxMembers: 200,
    maxStorageMb: 1024,
    sortOrder: 1,
    features: featureChecklist(STARTER_FEATURES),
  },
  {
    slug: 'professional',
    name: 'Professional',
    description: 'For growing gyms with multiple branches and a full-time team.',
    priceMonthly: 79,
    priceYearly: 790,
    trialDays: 14,
    maxBranches: 3,
    maxManagers: 5,
    maxTrainers: 15,
    maxReceptionists: 5,
    maxStaff: 40,
    maxMembers: 1000,
    maxStorageMb: 5120,
    sortOrder: 2,
    features: featureChecklist(PROFESSIONAL_FEATURES),
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'For gym chains that need custom roles, integrations, and white-label branding.',
    priceMonthly: 199,
    priceYearly: 1990,
    trialDays: 14,
    maxBranches: 9999,
    maxManagers: 9999,
    maxTrainers: 9999,
    maxReceptionists: 9999,
    maxStaff: 9999,
    maxMembers: 9999,
    maxStorageMb: 51200,
    sortOrder: 3,
    features: featureChecklist(ENTERPRISE_FEATURES),
  },
];

// ── Super Admin portal (Prompt 9) ────────────────────────────────────────

const ADMIN_PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: 'dashboard:read', description: 'View the admin dashboard' },
  { key: 'tenants:read', description: 'View tenant accounts' },
  { key: 'tenants:manage', description: 'Activate, suspend, delete, or impersonate a tenant' },
  { key: 'plans:manage', description: 'Create, update, enable/disable subscription plans' },
  { key: 'coupons:manage', description: 'Create, update, delete coupons' },
  { key: 'payments:read', description: 'View payments, invoices, and transaction logs across all tenants' },
  { key: 'revenue:read', description: 'View revenue analytics (MRR/ARR/growth)' },
  { key: 'support:manage', description: 'View, assign, and close support tickets' },
  { key: 'feature-flags:manage', description: 'Enable or disable modules globally' },
  { key: 'cms:manage', description: 'Manage landing page content, blogs, FAQs, legal pages' },
  { key: 'notifications:send', description: 'Send global notifications and announcements' },
  { key: 'settings:manage', description: 'Manage system settings (SMTP, gateways, storage, maintenance mode)' },
  { key: 'audit:read', description: 'View admin audit logs' },
  { key: 'admins:manage', description: 'Manage admin users, roles, and permissions' },
  { key: 'templates:manage', description: 'Manage email/SMS template content' },
  { key: 'reference-data:manage', description: 'Manage countries, currencies, and tax rules' },
];

const ADMIN_ROLE_PERMISSIONS: Record<string, string[] | '*'> = {
  SUPER_ADMIN: '*',
  SUPPORT_ADMIN: ['dashboard:read', 'tenants:read', 'support:manage', 'audit:read'],
  FINANCE_ADMIN: ['dashboard:read', 'payments:read', 'revenue:read', 'coupons:manage', 'plans:manage', 'audit:read'],
  CONTENT_ADMIN: ['dashboard:read', 'cms:manage', 'templates:manage', 'notifications:send', 'audit:read'],
  TECHNICAL_ADMIN: ['dashboard:read', 'feature-flags:manage', 'settings:manage', 'reference-data:manage', 'audit:read'],
};

const FEATURE_FLAGS: Array<{ key: string; label: string; category: string }> = [
  { key: 'attendance', label: 'Attendance', category: 'operations' },
  { key: 'workout', label: 'Workout plans', category: 'operations' },
  { key: 'diet', label: 'Diet plans', category: 'operations' },
  { key: 'reports', label: 'Reports', category: 'operations' },
  { key: 'analytics', label: 'Analytics', category: 'operations' },
  { key: 'chat', label: 'Chat', category: 'communication' },
  { key: 'inventory', label: 'Inventory', category: 'operations' },
  { key: 'pos', label: 'Point of sale', category: 'operations' },
  { key: 'white_label', label: 'White label branding', category: 'platform' },
  { key: 'custom_domain', label: 'Custom domain', category: 'platform' },
  { key: 'video_training', label: 'Video training (future)', category: 'future' },
  { key: 'ai_coach', label: 'AI coach (future)', category: 'future' },
  { key: 'marketplace', label: 'Marketplace (future)', category: 'future' },
];

const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IN', name: 'India' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
];

const CURRENCIES: Array<{ code: string; name: string; symbol: string }> = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
];

async function main(): Promise<void> {
  console.log('Seeding permission catalog...');
  const permissionByKey = new Map<string, { id: string }>();

  for (const permission of PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
    permissionByKey.set(permission.key, created);
  }

  console.log('Seeding system roles...');
  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    // Prisma's compound-unique `where` rejects an explicit `null` for a
    // nullable key column (tenantId) — find-then-create/update instead.
    const existingRole = await prisma.role.findFirst({ where: { tenantId: null, name: roleName } });
    const role = existingRole
      ? await prisma.role.update({ where: { id: existingRole.id }, data: { isSystem: true } })
      : await prisma.role.create({
          data: { name: roleName, isSystem: true, tenantId: null, description: `System role: ${roleName}` },
        });

    const grantedKeys = ROLE_PERMISSIONS[roleName] === '*' ? PERMISSIONS.map((p) => p.key) : (ROLE_PERMISSIONS[roleName] as string[]);

    for (const key of grantedKeys) {
      const permission = permissionByKey.get(key);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
    console.log(`  ${roleName}: ${grantedKeys.length} permissions`);
  }

  console.log('Seeding subscription plan catalog...');
  for (const plan of SUBSCRIPTION_PLANS) {
    const created = await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        trialDays: plan.trialDays,
        maxBranches: plan.maxBranches,
        maxManagers: plan.maxManagers,
        maxTrainers: plan.maxTrainers,
        maxReceptionists: plan.maxReceptionists,
        maxStaff: plan.maxStaff,
        maxMembers: plan.maxMembers,
        maxStorageMb: plan.maxStorageMb,
        sortOrder: plan.sortOrder,
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        trialDays: plan.trialDays,
        maxBranches: plan.maxBranches,
        maxManagers: plan.maxManagers,
        maxTrainers: plan.maxTrainers,
        maxReceptionists: plan.maxReceptionists,
        maxStaff: plan.maxStaff,
        maxMembers: plan.maxMembers,
        maxStorageMb: plan.maxStorageMb,
        sortOrder: plan.sortOrder,
      },
    });

    for (const [index, feature] of plan.features.entries()) {
      await prisma.subscriptionPlanFeature.upsert({
        where: { planId_key: { planId: created.id, key: feature.key } },
        create: { planId: created.id, key: feature.key, label: feature.label, included: feature.included, sortOrder: index },
        update: { label: feature.label, included: feature.included, sortOrder: index },
      });
    }
    // Full sync, not merge — drop any feature key from an earlier seed run
    // (e.g. Prompt 7's narrower catalog) that the current catalog replaced.
    await prisma.subscriptionPlanFeature.deleteMany({
      where: { planId: created.id, key: { notIn: plan.features.map((f) => f.key) } },
    });
    console.log(`  ${plan.name}: ${plan.features.length} features`);
  }

  console.log('Seeding tax rules...');
  for (const rule of TAX_RULES) {
    // Same nullable-composite-key limitation as the system-role seed above —
    // upsert on a compound unique rejects an explicit null for stateCode.
    const existing = await prisma.taxRule.findFirst({ where: { countryCode: rule.countryCode, stateCode: rule.stateCode } });
    if (existing) {
      await prisma.taxRule.update({ where: { id: existing.id }, data: { label: rule.label, ratePercent: rule.ratePercent } });
    } else {
      await prisma.taxRule.create({ data: rule });
    }
  }
  console.log(`  ${TAX_RULES.length} tax rules`);

  console.log('Seeding admin permission catalog...');
  const adminPermissionByKey = new Map<string, { id: string }>();
  for (const permission of ADMIN_PERMISSIONS) {
    const created = await prisma.adminPermission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
    adminPermissionByKey.set(permission.key, created);
  }

  console.log('Seeding admin roles...');
  const adminRoleByName = new Map<string, { id: string }>();
  for (const roleName of Object.keys(ADMIN_ROLE_PERMISSIONS)) {
    const role = await prisma.adminRole.upsert({
      where: { name: roleName },
      create: { name: roleName, isSystem: true, description: `System admin role: ${roleName}` },
      update: { isSystem: true },
    });
    adminRoleByName.set(roleName, role);

    const grantedKeys = ADMIN_ROLE_PERMISSIONS[roleName] === '*' ? ADMIN_PERMISSIONS.map((p) => p.key) : (ADMIN_ROLE_PERMISSIONS[roleName] as string[]);
    for (const key of grantedKeys) {
      const permission = adminPermissionByKey.get(key);
      if (!permission) continue;
      await prisma.adminRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
    console.log(`  ${roleName}: ${grantedKeys.length} permissions`);
  }

  console.log('Seeding default super admin user...');
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@fitcloud.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@2026';
  const superAdminRole = adminRoleByName.get('SUPER_ADMIN')!;
  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: superAdminEmail } });
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        name: 'Super Admin',
        email: superAdminEmail,
        passwordHash: await hashPassword(superAdminPassword),
        roleId: superAdminRole.id,
        status: 'ACTIVE',
      },
    });
    console.log(`  Created ${superAdminEmail} — CHANGE THIS PASSWORD in any non-local environment.`);
  } else {
    console.log(`  ${superAdminEmail} already exists, skipping.`);
  }

  console.log('Seeding feature flags...');
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: { ...flag, enabled: true },
      update: { label: flag.label, category: flag.category },
    });
  }
  console.log(`  ${FEATURE_FLAGS.length} feature flags`);

  console.log('Seeding countries...');
  for (const country of COUNTRIES) {
    await prisma.country.upsert({ where: { code: country.code }, create: { ...country, isActive: true }, update: { name: country.name } });
  }
  console.log(`  ${COUNTRIES.length} countries`);

  console.log('Seeding currencies...');
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({ where: { code: currency.code }, create: { ...currency, isActive: true }, update: { name: currency.name, symbol: currency.symbol } });
  }
  console.log(`  ${CURRENCIES.length} currencies`);

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

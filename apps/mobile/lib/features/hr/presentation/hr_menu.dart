import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/utils/tenant_features.dart';
import '../../../shared/widgets/menu_entry.dart';

/// The "HR" section every staff role's menu shows - the same seven entries, in
/// the same order and with the same permission gating as the web sidebar's `hr`
/// sub-links (`tenant-web/.../nav-config.ts`). One definition, gated by the
/// standard `MenuEntry.permissions` (any-of), so a tile is visible exactly when
/// the user holds one of its keys - nothing role-locked, nothing new for roles
/// without the HR keys (their menu is unchanged).
///
/// | Tile | Opens | Key |
/// |---|---|---|
/// | Overview | today, trend, quick actions | `hr:view` |
/// | Employees | directory + detail | `hr:view` |
/// | Attendance | day roster + monthly grid | `hr:view` |
/// | Leaves | requests inbox + team calendar | `hr:leave_manage` |
/// | Payroll | generate, approve, pay | `hr:payroll_manage` |
/// | Setup | shifts, holidays, leave types, policy | `hr:view` (edits per key) |
/// | My HR | check in, leave, payslips | any `hr:self_*` |
///
/// Every tile carries `featureFlag: Feature.hr`: HR is a plan module with a
/// platform kill switch, so with the gym's `hr` flag off the whole section
/// disappears from all four staff menus (flag AND permission, never either).
const hrMenuEntries = <MenuEntry>[
  MenuEntry(
    featureFlag: Feature.hr,
    icon: Icons.grid_view_rounded,
    title: 'Overview',
    subtitle: 'Today, trends and quick actions',
    route: AppRoutes.hrOverview,
    permissions: ['hr:view'],
  ),
  MenuEntry(
    featureFlag: Feature.hr,
    icon: Icons.badge_rounded,
    title: 'Employees',
    subtitle: 'Shifts, pay and leave per person',
    route: AppRoutes.hrEmployees,
    permissions: ['hr:view'],
  ),
  MenuEntry(
    featureFlag: Feature.hr,
    icon: Icons.event_available_rounded,
    title: 'Attendance',
    subtitle: 'Day roster and monthly grid',
    route: AppRoutes.hrTeamAttendance,
    permissions: ['hr:view'],
  ),
  MenuEntry(
    featureFlag: Feature.hr,
    icon: Icons.fact_check_rounded,
    title: 'Leaves',
    subtitle: 'Requests, approvals, team calendar',
    route: AppRoutes.hrApprovals,
    permissions: ['hr:leave_manage'],
  ),
  MenuEntry(
    featureFlag: Feature.hr,
    icon: Icons.payments_rounded,
    title: 'Payroll',
    subtitle: 'Generate, approve and pay',
    route: AppRoutes.hrPayroll,
    permissions: ['hr:payroll_manage'],
  ),
  MenuEntry(
    featureFlag: Feature.hr,
    icon: Icons.tune_rounded,
    title: 'Setup',
    subtitle: 'Shifts, holidays, leave types, policy',
    route: AppRoutes.hrSetup,
    permissions: ['hr:view'],
  ),
  MenuEntry(
    featureFlag: Feature.hr,
    icon: Icons.how_to_reg_rounded,
    title: 'My HR',
    subtitle: 'Check in, leave, payslips',
    route: AppRoutes.hrMe,
    permissions: [
      'hr:self_attendance',
      'hr:self_leave',
      'hr:self_payslip',
    ],
  ),
];

import 'package:flutter/material.dart';

import '../../../core/routing/app_routes.dart';
import '../../../shared/widgets/menu_entry.dart';

/// The "HR" section every staff role's menu shows. One definition, gated by
/// the standard `MenuEntry.permissions` (any-of) so a tile is visible exactly
/// when the user holds one of its keys - nothing role-locked, nothing new for
/// roles without the HR keys (their menu is unchanged).
///
/// * **My HR** - any `hr:self_*` key (attendance, leave, payslips).
/// * **HR Management** - `hr:view` (overview, team attendance, employees).
/// * **Leave Approvals** - `hr:leave_manage`.
///
/// No `featureFlag`: HR is not a plan-gated module in the API contract.
const hrMenuEntries = <MenuEntry>[
  MenuEntry(
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
  MenuEntry(
    icon: Icons.groups_2_rounded,
    title: 'HR Management',
    subtitle: 'Attendance, employees, payroll',
    route: AppRoutes.hrOverview,
    permissions: ['hr:view'],
  ),
  MenuEntry(
    icon: Icons.fact_check_rounded,
    title: 'Leave Approvals',
    subtitle: 'Approve or reject requests',
    route: AppRoutes.hrApprovals,
    permissions: ['hr:leave_manage'],
  ),
];

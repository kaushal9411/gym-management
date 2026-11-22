import 'package:flutter/material.dart';

import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../../shared/widgets/shell_tabs.dart';
import '../../finance/presentation/finance_tab.dart';
import '../../manager/presentation/members_screen.dart';
import '../../reports/presentation/reports_center_screen.dart';
import 'dashboard_screen.dart';
import 'menu_screen.dart';

/// Tenant/Owner shell — the 4-tab bottom nav from design frame "4.
/// Dashboard" (Home/Members/Finance/Reports) plus a hamburger-triggered
/// [MenuScreen] drawer (the former 5th "Menu" tab — see its own doc
/// comment). Members reuses [MembersScreen] from the Manager module
/// unmodified — it's permission-gated, not role-locked, and an Owner's
/// `members:*` grants are a superset of a Manager's (same reuse as
/// [ReceptionistShell]).
class OwnerShell extends StatelessWidget {
  const OwnerShell({super.key});

  /// ONE ordered list (nav item + screen + module gate): the nav and the
  /// IndexedStack are both built from it, so a tab filtered off the nav (module
  /// switched off) can never leave them out of step. Public so tests can read
  /// the table without building the tabs.
  static const tabs = [
    ShellTab(
      id: 'home',
      item: GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
      child: DashboardScreen(),
    ),
    ShellTab(
      id: 'members',
      item: GlassNavItem(icon: Icons.groups_rounded, label: 'Members'),
      child: MembersScreen(),
    ),
    // Finance stays while any of its modules (payments / income / expenses) is on.
    ShellTab(
      id: 'finance',
      item: GlassNavItem(
        icon: Icons.account_balance_wallet_rounded,
        label: 'Finance',
      ),
      child: FinanceTab(),
      featureFlagsAny: ['payments', 'income', 'expenses'],
    ),
    ShellTab(
      id: 'reports',
      item: GlassNavItem(icon: Icons.bar_chart_rounded, label: 'Reports'),
      child: ReportsCenterScreen(),
      featureFlag: 'reports',
    ),
  ];

  @override
  Widget build(BuildContext context) =>
      const FlagTabsShell(tabs: tabs, drawer: MenuScreen());
}

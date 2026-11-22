import 'package:flutter/material.dart';

import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../../shared/widgets/shell_tabs.dart';
import '../../attendance/presentation/attendance_today_screen.dart';
import 'manager_dashboard_screen.dart';
import 'manager_menu_screen.dart';
import 'members_screen.dart';
import 'team_screen.dart';

/// Manager shell — the 4-tab bottom nav from design frame "4. Dashboard"
/// (Home/Team/Members/Attendance), distinct from Owner's
/// Home/Members/Finance/Reports, plus a hamburger-triggered
/// [ManagerMenuScreen] drawer (the former 5th "Menu" tab).
class ManagerShell extends StatelessWidget {
  const ManagerShell({super.key});

  /// ONE ordered list (nav item + screen + module gate): the nav and the
  /// IndexedStack are both built from it, so a tab filtered off the nav (module
  /// switched off) can never leave them out of step. Public so tests can read
  /// the table without building the tabs.
  static const tabs = [
    ShellTab(
      id: 'home',
      item: GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
      child: ManagerDashboardScreen(),
    ),
    ShellTab(
      id: 'team',
      item: GlassNavItem(icon: Icons.groups_rounded, label: 'Team'),
      child: TeamScreen(),
    ),
    ShellTab(
      id: 'members',
      item: GlassNavItem(icon: Icons.people_alt_rounded, label: 'Members'),
      child: MembersScreen(),
    ),
    ShellTab(
      id: 'attendance',
      item: GlassNavItem(icon: Icons.fact_check_rounded, label: 'Attendance'),
      child: AttendanceTodayScreen(asTab: true),
      featureFlag: 'attendance',
    ),
  ];

  @override
  Widget build(BuildContext context) =>
      const FlagTabsShell(tabs: tabs, drawer: ManagerMenuScreen());
}

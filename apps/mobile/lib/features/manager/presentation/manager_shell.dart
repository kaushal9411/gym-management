import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../attendance/presentation/attendance_today_screen.dart';
import 'manager_dashboard_screen.dart';
import 'manager_menu_screen.dart';
import 'members_screen.dart';
import 'team_screen.dart';

/// Manager shell — the 4-tab bottom nav from design frame "4. Dashboard"
/// (Home/Team/Members/Attendance), distinct from Owner's
/// Home/Members/Finance/Reports, plus a hamburger-triggered
/// [ManagerMenuScreen] drawer (the former 5th "Menu" tab).
class ManagerShell extends StatefulWidget {
  const ManagerShell({super.key});

  @override
  State<ManagerShell> createState() => _ManagerShellState();
}

class _ManagerShellState extends State<ManagerShell> {
  int _index = 0;

  static const _tabs = [
    ManagerDashboardScreen(),
    TeamScreen(),
    MembersScreen(),
    AttendanceTodayScreen(asTab: true),
  ];

  static const _navItems = [
    GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
    GlassNavItem(icon: Icons.groups_rounded, label: 'Team'),
    GlassNavItem(icon: Icons.people_alt_rounded, label: 'Members'),
    GlassNavItem(icon: Icons.fact_check_rounded, label: 'Attendance'),
  ];

  @override
  Widget build(BuildContext context) {
    return SlideDrawerScaffold(
      backgroundColor: AppColors.bg,
      drawer: const ManagerMenuScreen(),
      body: SafeArea(
        bottom: false,
        child: IndexedStack(index: _index, children: _tabs),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: GlassBottomNav(
          items: _navItems,
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
        ),
      ),
    );
  }
}

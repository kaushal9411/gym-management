import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../../shared/widgets/glass_bottom_nav.dart';
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
class OwnerShell extends StatefulWidget {
  const OwnerShell({super.key});

  @override
  State<OwnerShell> createState() => _OwnerShellState();
}

class _OwnerShellState extends State<OwnerShell> {
  int _index = 0;

  static const _tabs = [
    DashboardScreen(),
    MembersScreen(),
    FinanceTab(),
    ReportsCenterScreen(),
  ];

  static const _navItems = [
    GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
    GlassNavItem(icon: Icons.groups_rounded, label: 'Members'),
    GlassNavItem(icon: Icons.account_balance_wallet_rounded, label: 'Finance'),
    GlassNavItem(icon: Icons.bar_chart_rounded, label: 'Reports'),
  ];

  @override
  Widget build(BuildContext context) {
    return SlideDrawerScaffold(
      backgroundColor: AppColors.bg,
      drawer: const MenuScreen(),
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

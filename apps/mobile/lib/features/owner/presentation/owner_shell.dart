import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../finance/presentation/finance_tab.dart';
import '../../reports/presentation/reports_center_screen.dart';
import 'dashboard_screen.dart';
import 'menu_screen.dart';
import 'widgets/coming_soon_tab.dart';

/// Tenant/Owner shell — the 5-tab bottom nav from design frame "4.
/// Dashboard" (Home/Members/Finance/Reports/Menu). Members is still a
/// [ComingSoonTab] placeholder until its sub-chunk lands.
class OwnerShell extends StatefulWidget {
  const OwnerShell({super.key});

  @override
  State<OwnerShell> createState() => _OwnerShellState();
}

class _OwnerShellState extends State<OwnerShell> {
  int _index = 0;

  static const _tabs = [
    DashboardScreen(),
    ComingSoonTab(title: 'Members'),
    FinanceTab(),
    ReportsCenterScreen(),
    MenuScreen(),
  ];

  static const _navItems = [
    GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
    GlassNavItem(icon: Icons.groups_rounded, label: 'Members'),
    GlassNavItem(icon: Icons.account_balance_wallet_rounded, label: 'Finance'),
    GlassNavItem(icon: Icons.bar_chart_rounded, label: 'Reports'),
    GlassNavItem(icon: Icons.menu_rounded, label: 'Menu'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
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

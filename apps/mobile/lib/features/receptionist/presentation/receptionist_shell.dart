import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../finance/presentation/record_payment_screen.dart';
import '../../manager/presentation/members_screen.dart';
import 'check_in_screen.dart';
import 'classes_calendar_screen.dart';
import 'receptionist_menu_screen.dart';

/// Receptionist shell — the 5-tab bottom nav from design frame "4. Scan
/// check-in" (Home/Members/Classes/Payments/Menu). Members reuses
/// [MembersScreen] from the Manager module unmodified — it's
/// permission-gated, not role-locked, and Receptionist's `members:*`
/// grant is a strict subset of Manager's. Payments reuses
/// [RecordPaymentScreen] as-is (its own `Scaffold`+`AppBar`, fine as a tab
/// root since this shell has no `AppBar` of its own to conflict with).
class ReceptionistShell extends StatefulWidget {
  const ReceptionistShell({super.key});

  @override
  State<ReceptionistShell> createState() => _ReceptionistShellState();
}

class _ReceptionistShellState extends State<ReceptionistShell> {
  int _index = 0;

  static const _tabs = [
    CheckInScreen(),
    MembersScreen(),
    ClassesCalendarScreen(),
    RecordPaymentScreen(),
    ReceptionistMenuScreen(),
  ];

  static const _navItems = [
    GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
    GlassNavItem(icon: Icons.people_alt_rounded, label: 'Members'),
    GlassNavItem(icon: Icons.event_note_rounded, label: 'Classes'),
    GlassNavItem(icon: Icons.payments_rounded, label: 'Payments'),
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

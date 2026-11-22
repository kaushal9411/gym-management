import 'package:flutter/material.dart';

import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../../shared/widgets/shell_tabs.dart';
import '../../finance/presentation/record_payment_screen.dart';
import '../../manager/presentation/members_screen.dart';
import 'check_in_screen.dart';
import '../../classes/presentation/classes_calendar_screen.dart';
import 'receptionist_menu_screen.dart';

/// Receptionist shell — the 4-tab bottom nav from design frame "4. Scan
/// check-in" (Home/Members/Classes/Payments). Members reuses
/// [MembersScreen] from the Manager module unmodified — it's
/// permission-gated, not role-locked, and Receptionist's `members:*`
/// grant is a strict subset of Manager's. Payments reuses
/// [RecordPaymentScreen] as-is (its own `Scaffold`+`AppBar`) — it has no
/// hamburger of its own: its `AppBar` sits inside a SECOND, nested
/// `Scaffold`, so `SlideDrawerController.of(context)` there would need to
/// be threaded through explicitly rather than just dropping in a
/// [MenuButton]; left as a known gap, the other 3 tabs still reach the
/// drawer fine. A hamburger-triggered [ReceptionistMenuScreen] drawer
/// replaces the former 5th "Menu" tab.
class ReceptionistShell extends StatelessWidget {
  const ReceptionistShell({super.key});

  /// ONE ordered list (nav item + screen + module gate): the nav and the
  /// IndexedStack are both built from it, so a tab filtered off the nav (module
  /// switched off) can never leave them out of step. Public so tests can read
  /// the table without building the tabs.
  static const tabs = [
    ShellTab(
      id: 'home',
      item: GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
      child: CheckInScreen(),
    ),
    ShellTab(
      id: 'members',
      item: GlassNavItem(icon: Icons.people_alt_rounded, label: 'Members'),
      child: MembersScreen(),
    ),
    ShellTab(
      id: 'classes',
      item: GlassNavItem(icon: Icons.event_note_rounded, label: 'Classes'),
      child: ClassesCalendarScreen(),
      featureFlag: 'live_classes',
    ),
    ShellTab(
      id: 'payments',
      item: GlassNavItem(icon: Icons.payments_rounded, label: 'Payments'),
      child: RecordPaymentScreen(),
      featureFlag: 'payments',
    ),
  ];

  @override
  Widget build(BuildContext context) =>
      const FlagTabsShell(tabs: tabs, drawer: ReceptionistMenuScreen());
}

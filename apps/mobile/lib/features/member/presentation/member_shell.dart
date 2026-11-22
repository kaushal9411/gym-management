import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../../shared/widgets/shell_tabs.dart';
import 'member_classes_screen.dart';
import 'member_dashboard_screen.dart';
import 'member_diet_screen.dart';
import 'member_menu_screen.dart';
import 'member_workout_screen.dart';

/// The member plane's shell — the design's 4-tab nav (Home/Workout/Diet/
/// Classes) in the member palette (lime→teal), the only shell in the app
/// that isn't staff-accented. A hamburger-triggered [MemberMenuScreen]
/// drawer replaces the former 5th "Menu" tab.
///
/// Workout / Diet / Classes follow the gym's `workout_plans` / `diet_plans` /
/// `live_classes` modules: a tab whose module is switched off is dropped from
/// the nav (and the IndexedStack) — see [FlagTabsShell].
class MemberShell extends StatefulWidget {
  const MemberShell({super.key});

  /// Tab ids in their canonical order. `MemberDashboardScreen.onQuickAction`
  /// reports a position in THIS list (1 Workout, 2 Diet, 3 Classes), which
  /// stays valid however many tabs are currently filtered off the nav.
  static const canonicalIds = ['home', 'workout', 'diet', 'classes'];

  /// The tab table, with the dashboard's quick actions wired to [onQuickAction].
  /// Public so tests can read ids/labels/flags without building the screens.
  static List<ShellTab> tabsFor(ValueChanged<int> onQuickAction) => [
        ShellTab(
          id: 'home',
          item: const GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
          child: MemberDashboardScreen(onQuickAction: onQuickAction),
        ),
        const ShellTab(
          id: 'workout',
          item: GlassNavItem(
            icon: Icons.fitness_center_rounded,
            label: 'Workout',
          ),
          child: MemberWorkoutScreen(),
          featureFlag: 'workout_plans',
        ),
        const ShellTab(
          id: 'diet',
          item: GlassNavItem(icon: Icons.restaurant_rounded, label: 'Diet'),
          child: MemberDietScreen(),
          featureFlag: 'diet_plans',
        ),
        const ShellTab(
          id: 'classes',
          item: GlassNavItem(icon: Icons.event_note_rounded, label: 'Classes'),
          child: MemberClassesScreen(),
          featureFlag: 'live_classes',
        ),
      ];

  @override
  State<MemberShell> createState() => _MemberShellState();
}

class _MemberShellState extends State<MemberShell> {
  final _controller = ShellTabController();

  void _jumpTo(int canonicalIndex) {
    if (canonicalIndex < 0 ||
        canonicalIndex >= MemberShell.canonicalIds.length) {
      return;
    }
    // A jump to a tab whose module is off is a no-op (the dashboard hides
    // those entry points; this is the safety net).
    _controller.select(MemberShell.canonicalIds[canonicalIndex]);
  }

  @override
  Widget build(BuildContext context) => FlagTabsShell(
        tabs: MemberShell.tabsFor(_jumpTo),
        drawer: const MemberMenuScreen(),
        role: AppRole.member,
        controller: _controller,
      );
}

import 'package:flutter/material.dart';

import '../../../shared/widgets/glass_bottom_nav.dart';
import '../../../shared/widgets/shell_tabs.dart';
import 'exercise_library_screen.dart';
import 'food_library_screen.dart';
import 'my_clients_screen.dart';
import 'trainer_menu_screen.dart';

/// Trainer shell — the 3-tab bottom nav from design frame "5. Exercise
/// library" (Home/Workouts/Diet), the only role with 3 tabs instead of 4:
/// Trainer has no finance/branch-management surface. A hamburger-triggered
/// [TrainerMenuScreen] drawer replaces the former 4th "Menu" tab.
class TrainerShell extends StatelessWidget {
  const TrainerShell({super.key});

  /// ONE ordered list (nav item + screen + module gate): the nav and the
  /// IndexedStack are both built from it, so a tab filtered off the nav (module
  /// switched off) can never leave them out of step. Public so tests can read
  /// the table without building the tabs.
  static const tabs = [
    ShellTab(
      id: 'home',
      item: GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
      child: MyClientsScreen(),
    ),
    ShellTab(
      id: 'workouts',
      item: GlassNavItem(
        icon: Icons.fitness_center_rounded,
        label: 'Workouts',
      ),
      child: ExerciseLibraryScreen(),
      featureFlag: 'workout_plans',
    ),
    ShellTab(
      id: 'diet',
      item: GlassNavItem(icon: Icons.restaurant_rounded, label: 'Diet'),
      child: FoodLibraryScreen(),
      featureFlag: 'diet_plans',
    ),
  ];

  @override
  Widget build(BuildContext context) =>
      const FlagTabsShell(tabs: tabs, drawer: TrainerMenuScreen());
}

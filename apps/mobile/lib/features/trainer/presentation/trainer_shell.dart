import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/glass_bottom_nav.dart';
import 'exercise_library_screen.dart';
import 'food_library_screen.dart';
import 'my_clients_screen.dart';
import 'trainer_menu_screen.dart';

/// Trainer shell — the 4-tab bottom nav from design frame "5. Exercise
/// library" (Home/Workouts/Diet/Menu), the only role with 4 tabs instead
/// of 5: Trainer has no finance/branch-management surface.
class TrainerShell extends StatefulWidget {
  const TrainerShell({super.key});

  @override
  State<TrainerShell> createState() => _TrainerShellState();
}

class _TrainerShellState extends State<TrainerShell> {
  int _index = 0;

  static const _tabs = [
    MyClientsScreen(),
    ExerciseLibraryScreen(),
    FoodLibraryScreen(),
    TrainerMenuScreen(),
  ];

  static const _navItems = [
    GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
    GlassNavItem(icon: Icons.fitness_center_rounded, label: 'Workouts'),
    GlassNavItem(icon: Icons.restaurant_rounded, label: 'Diet'),
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

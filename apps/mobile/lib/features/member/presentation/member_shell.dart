import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../../shared/widgets/glass_bottom_nav.dart';
import 'member_classes_screen.dart';
import 'member_dashboard_screen.dart';
import 'member_diet_screen.dart';
import 'member_menu_screen.dart';
import 'member_workout_screen.dart';

/// The member plane's shell — the design's 4-tab nav (Home/Workout/Diet/
/// Classes) in the member palette (lime→teal), the only shell in the app
/// that isn't staff-accented. A hamburger-triggered [MemberMenuScreen]
/// drawer replaces the former 5th "Menu" tab.
class MemberShell extends StatefulWidget {
  const MemberShell({super.key});

  @override
  State<MemberShell> createState() => _MemberShellState();
}

class _MemberShellState extends State<MemberShell> {
  int _index = 0;

  static const _navItems = [
    GlassNavItem(icon: Icons.home_rounded, label: 'Home'),
    GlassNavItem(icon: Icons.fitness_center_rounded, label: 'Workout'),
    GlassNavItem(icon: Icons.restaurant_rounded, label: 'Diet'),
    GlassNavItem(icon: Icons.event_note_rounded, label: 'Classes'),
  ];

  @override
  Widget build(BuildContext context) {
    final tabs = [
      MemberDashboardScreen(
        onQuickAction: (index) => setState(() => _index = index),
      ),
      const MemberWorkoutScreen(),
      const MemberDietScreen(),
      const MemberClassesScreen(),
    ];

    return SlideDrawerScaffold(
      backgroundColor: AppColors.bg,
      drawer: const MemberMenuScreen(),
      body: SafeArea(
        bottom: false,
        child: IndexedStack(index: _index, children: tabs),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: GlassBottomNav(
          items: _navItems,
          currentIndex: _index,
          role: AppRole.member,
          onTap: (i) => setState(() => _index = i),
        ),
      ),
    );
  }
}

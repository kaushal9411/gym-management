import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

class GlassNavItem {
  const GlassNavItem({required this.icon, required this.label});

  final IconData icon;
  final String label;
}

/// `.bottomnav` — the floating frosted-glass tab bar shared by every
/// role's shell (Tenant/Manager/Trainer/Receptionist/Member), with a
/// role-accented active state + dot indicator. Built now as shared chrome;
/// each role's actual item set/routes are wired up in that role's chunk.
class GlassBottomNav extends StatelessWidget {
  const GlassBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
    this.role = AppRole.staff,
  });

  final List<GlassNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.bottomNav),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.glassFill,
              borderRadius: BorderRadius.circular(AppRadii.bottomNav),
              border: Border.all(color: AppColors.glassBorder),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x80000000),
                  blurRadius: 32,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(items.length, (i) {
                final selected = i == currentIndex;
                final color = selected ? role.a : AppColors.inkFaint;
                return Expanded(
                  child: InkWell(
                    onTap: () => onTap(i),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(items[i].icon, size: 20, color: color),
                        const SizedBox(height: 4),
                        Text(
                          items[i].label,
                          style: AppText.body(
                            size: 9,
                            weight: FontWeight.w800,
                            color: color,
                          ),
                        ),
                        const SizedBox(height: 4),
                        AnimatedOpacity(
                          duration: const Duration(milliseconds: 150),
                          opacity: selected ? 1 : 0,
                          child: Container(
                            width: 5,
                            height: 5,
                            decoration: BoxDecoration(
                              color: role.a,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

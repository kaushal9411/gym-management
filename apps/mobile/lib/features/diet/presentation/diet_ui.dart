import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../plans/presentation/plan_ui.dart' show PlanGlyph;
import '../../team/presentation/widgets/team_ui.dart';

/// Shared building blocks for the Diet Plans screens (the Owner / Manager
/// catalog and the Trainer's per-client flow): status colours, meal-slot
/// colours + glyphs, the meal rows and the edit-screen banner. Same visual
/// language as the Membership Plans / Workout Plans / Branches redesigns - it
/// reuses the Team kit (`team_ui.dart`) and only adds what is diet-specific.

// ── status ──────────────────────────────────────────────────────────────────

Color dietTone({required bool deleted, required bool active}) => deleted
    ? TeamColors.rose
    : active
        ? TeamColors.green
        : TeamColors.amber;

String dietStatus({required bool deleted, required bool active}) => deleted
    ? 'Deleted'
    : active
        ? 'Active'
        : 'Inactive';

IconData dietStatusIcon({required bool deleted, required bool active}) =>
    deleted
        ? Icons.delete_outline_rounded
        : active
            ? Icons.check_circle_rounded
            : Icons.pause_circle_rounded;

// ── meal slots ──────────────────────────────────────────────────────────────

/// One colour per meal slot (web's `MEAL_ACCENTS`).
Color mealColor(MealType t) => switch (t) {
      MealType.breakfast => TeamColors.amber,
      MealType.morningSnack => TeamColors.teal,
      MealType.lunch => TeamColors.indigo,
      MealType.eveningSnack => TeamColors.sky,
      MealType.dinner => TeamColors.violet,
      MealType.preWorkout => TeamColors.green,
      MealType.postWorkout => TeamColors.rose,
    };

IconData mealIcon(MealType t) => switch (t) {
      MealType.breakfast => Icons.free_breakfast_rounded,
      MealType.morningSnack => Icons.apple_rounded,
      MealType.lunch => Icons.lunch_dining_rounded,
      MealType.eveningSnack => Icons.cookie_rounded,
      MealType.dinner => Icons.dinner_dining_rounded,
      MealType.preWorkout => Icons.bolt_rounded,
      MealType.postWorkout => Icons.fitness_center_rounded,
    };

// ── formatting ──────────────────────────────────────────────────────────────

String daysLabel(int d) => '$d ${d == 1 ? 'day' : 'days'}';

String kcalLabel(int? k) => k == null ? '—' : '$k kcal';

/// `2` for 2.0, `1.5` for 1.5, `0.25` for 0.25 (never `2.0` / `1.50`).
String qtyLabel(double q) {
  if (q == q.roundToDouble()) return q.toStringAsFixed(0);
  var s = q.toStringAsFixed(2);
  if (s.endsWith('0')) s = s.substring(0, s.length - 1);
  return s;
}

// ── small pieces ────────────────────────────────────────────────────────────

class MiniChip extends StatelessWidget {
  const MiniChip({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 10.5,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A meal slot header strip: dot + name + count, tinted with the slot colour
/// (web's meal card heading).
class MealHeading extends StatelessWidget {
  const MealHeading({
    super.key,
    required this.type,
    required this.count,
    this.trailing,
  });

  final MealType type;
  final int count;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final color = mealColor(type);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.18),
            color.withValues(alpha: 0.02),
          ],
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(mealIcon(type), size: 16, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              type.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(size: 14, weight: FontWeight.w800),
            ),
          ),
          Text(
            count == 0 ? 'Empty' : '$count ${count == 1 ? 'food' : 'foods'}',
            style: AppText.body(
              size: 11.5,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

// ── banner (edit screens) ───────────────────────────────────────────────────

/// Gradient banner under a transparent AppBar (edit form, trainer create).
class DietBanner extends StatelessWidget {
  const DietBanner({
    super.key,
    required this.top,
    required this.name,
    required this.subtitle,
    required this.chip,
    required this.chipIcon,
  });

  final double top;
  final String name;
  final String subtitle;
  final String chip;
  final IconData chipIcon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, top + 4, 18, 22),
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF312E81), Color(0xFF7C3AED), TeamColors.fuchsia],
        ),
      ),
      child: TeamCenter(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
              child: const PlanGlyph(icon: Icons.restaurant_rounded),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 20, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TeamHeroPill(chip, icon: chipIcon),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

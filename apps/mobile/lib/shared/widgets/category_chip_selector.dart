import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

/// `.pill` used as a selectable category chip (design frames "5b"/"5d" —
/// income/expense category pickers).
class CategoryChipSelector<T> extends StatelessWidget {
  const CategoryChipSelector({
    super.key,
    required this.options,
    required this.labelOf,
    required this.value,
    required this.onChanged,
    this.role = AppRole.staff,
  });

  final List<T> options;
  final String Function(T) labelOf;
  final T value;
  final ValueChanged<T> onChanged;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((option) {
        final selected = option == value;
        return GestureDetector(
          onTap: () => onChanged(option),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              gradient: selected ? role.gradient : null,
              color: selected ? null : AppColors.surface3,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Text(
              labelOf(option),
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: selected ? role.onGradient : AppColors.inkSoft,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

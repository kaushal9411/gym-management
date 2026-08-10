import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch_option.dart';

/// Shared filter row for report/analytics screens — a branch chip picker
/// ("All branches" + each active branch) and, where the report is
/// date-ranged rather than point-in-time, a tap-to-open date range.
/// Mirrors the backend's `reportFiltersQuerySchema`/`trendQuerySchema`
/// (`branchId`, `dateFrom`/`dateTo`) — every option here is a real filter
/// the API actually applies, not a client-side-only cosmetic filter.
class ReportFilterBar extends StatelessWidget {
  const ReportFilterBar({
    super.key,
    required this.branches,
    required this.selectedBranchId,
    required this.onBranchChanged,
    this.dateRange,
    this.onDateRangeTap,
  });

  final List<BranchOption> branches;
  final String? selectedBranchId;
  final ValueChanged<String?> onBranchChanged;

  /// Null hides the date chip entirely (e.g. point-in-time reports like
  /// Staff Performance / Churn, which have no meaningful date range).
  final DateTimeRange? dateRange;
  final VoidCallback? onDateRangeTap;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          if (dateRange != null) ...[
            _FilterChip(
              icon: Icons.calendar_today_rounded,
              label: '${_fmt(dateRange!.start)} – ${_fmt(dateRange!.end)}',
              onTap: onDateRangeTap,
              selected: true,
            ),
            const SizedBox(width: 8),
          ],
          _FilterChip(
            icon: Icons.storefront_outlined,
            label: 'All branches',
            selected: selectedBranchId == null,
            onTap: () => onBranchChanged(null),
          ),
          for (final b in branches) ...[
            const SizedBox(width: 8),
            _FilterChip(
              label: b.name,
              selected: selectedBranchId == b.id,
              onTap: () => onBranchChanged(b.id),
            ),
          ],
        ],
      ),
    );
  }

  static String _fmt(DateTime d) => '${d.day}/${d.month}';
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    this.onTap,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? AppColors.staffGrad : null,
          color: selected ? null : AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 13,
                color: selected ? Colors.white : AppColors.inkSoft,
              ),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: selected ? Colors.white : AppColors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

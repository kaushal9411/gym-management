import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/ledger_analytics.dart';
import '../../income/presentation/income_filters.dart';
import '../../income/presentation/income_ui.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'expense_ui.dart';

/// Web's `LedgerFiltersBar` on `/expenses`: description search, Reset, the sort
/// (Date / Amount, either direction) and the category chips with their
/// per-category counts (from the analytics; omitted when unavailable).
///
/// The from / to date inputs web shows here are the same range as the Period
/// bar's Custom range (`IncomePeriodBar`, shared with Income), so mobile has
/// the one control.
class ExpenseFiltersBar extends StatelessWidget {
  const ExpenseFiltersBar({
    super.key,
    required this.searchKey,
    required this.onSearch,
    required this.onReset,
    required this.sortLabel,
    required this.onSort,
    required this.category,
    required this.onCategory,
    required this.counts,
  });

  final Key searchKey;
  final ValueChanged<String> onSearch;
  final VoidCallback onReset;
  final String sortLabel;
  final VoidCallback onSort;
  final String category;
  final ValueChanged<String> onCategory;
  final List<LedgerCategory>? counts;

  @override
  Widget build(BuildContext context) {
    final byCat = {for (final c in counts ?? <LedgerCategory>[]) c.category: c};
    final total = counts?.fold<int>(0, (s, c) => s + c.count);
    String withCount(String label, int? n) => n == null ? label : '$label $n';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TeamSearchField(
            key: searchKey,
            hint: 'Search description…',
            onSearch: onSearch,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.sort_rounded,
                  label: sortLabel,
                  onTap: onSort,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.restart_alt_rounded,
                  label: 'Reset',
                  onTap: onReset,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('CATEGORY', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          incomeChipRow([
            IncomeCategoryChip(
              label: withCount('All', total),
              selected: category.isEmpty,
              onTap: () => onCategory(''),
            ),
            for (final o in kExpenseCategoryOptions)
              IncomeCategoryChip(
                label: withCount(
                  o.$2,
                  counts == null ? null : (byCat[o.$1]?.count ?? 0),
                ),
                color: expenseCategoryColorOf(o.$1),
                selected: category == o.$1,
                onTap: () => onCategory(category == o.$1 ? '' : o.$1),
              ),
          ]),
        ],
      ),
    );
  }
}

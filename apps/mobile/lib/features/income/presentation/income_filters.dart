import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/ledger_analytics.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'income_ui.dart';

/// Wraps [chips] in a horizontally scrolling row.
Widget incomeChipRow(List<Widget> chips) => SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < chips.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            chips[i],
          ],
        ],
      ),
    );

/// Web's `PeriodBar`: period chips (Today / 7 days / This month / Last month
/// / 90 days / Custom), the branch select and the "Compare with previous
/// period" switch.
class IncomePeriodBar extends StatelessWidget {
  const IncomePeriodBar({
    super.key,
    required this.period,
    required this.customLabel,
    required this.onPeriod,
    required this.onCustom,
    required this.compare,
    required this.onCompare,
    this.branchId,
    this.branches = const [],
    this.onBranch,
  });

  final IncomePeriod period;

  /// "1 Oct – 18 Oct" while a custom range is active.
  final String customLabel;
  final ValueChanged<IncomePeriod> onPeriod;
  final VoidCallback onCustom;
  final String? branchId;
  final List<BranchOption> branches;

  /// Null hides the branch control (the notification and announcement feeds
  /// are tenant-wide — web's `NotificationPeriodBar` has no branch select).
  final VoidCallback? onBranch;
  final bool compare;
  final ValueChanged<bool> onCompare;

  @override
  Widget build(BuildContext context) {
    final branchLabel = branchId == null
        ? 'All branches'
        : branches
            .firstWhere(
              (b) => b.id == branchId,
              orElse: () => BranchOption(id: branchId!, name: 'Branch'),
            )
            .name;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('PERIOD', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          incomeChipRow([
            for (final p in IncomePeriod.values)
              if (p != IncomePeriod.custom)
                TeamFilterChip(
                  label: p.label,
                  selected: period == p,
                  color: TeamColors.indigo,
                  onTap: () => onPeriod(p),
                ),
            TeamFilterChip(
              label: period == IncomePeriod.custom ? customLabel : 'Custom…',
              selected: period == IncomePeriod.custom,
              color: TeamColors.indigo,
              onTap: onCustom,
            ),
          ]),
          const SizedBox(height: 10),
          if (onBranch != null) ...[
            TeamToolbarButton(
              icon: Icons.storefront_rounded,
              label: branchLabel,
              active: branchId != null,
              onTap: onBranch!,
            ),
            const SizedBox(height: 4),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  'Compare with previous period',
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
              ),
              Switch(
                key: const ValueKey('income-compare'),
                value: compare,
                activeThumbColor: Colors.white,
                activeTrackColor: TeamColors.violet,
                onChanged: onCompare,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Web's `LedgerFiltersBar`: description search, Reset, the sort
/// (Date / Amount, either direction) and the category chips with their
/// per-category counts (from the analytics; omitted when unavailable).
///
/// The from / to date inputs web shows here are the same range as the Period
/// bar's Custom range, so mobile has the one control.
class IncomeFiltersBar extends StatelessWidget {
  const IncomeFiltersBar({
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
            for (final o in kIncomeCategoryOptions)
              IncomeCategoryChip(
                label: withCount(
                  o.$2,
                  counts == null ? null : (byCat[o.$1]?.count ?? 0),
                ),
                color: incomeCategoryColorOf(o.$1),
                selected: category == o.$1,
                onTap: () => onCategory(category == o.$1 ? '' : o.$1),
              ),
          ]),
        ],
      ),
    );
  }
}

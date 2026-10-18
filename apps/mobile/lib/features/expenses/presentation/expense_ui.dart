import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/expense_entry.dart';
import '../../../models/user_profile.dart';
import '../../income/presentation/income_ui.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared kit for the Expenses screens (list, add form): the access matrix,
/// category metadata and the entry card. The period maths, number / date
/// helpers and the chips are the Income kit's (`income_ui.dart`) — web shares
/// the same `computeRange`, `DeltaText` and ledger panels between its Income
/// and Expenses pages.

// ── access ──────────────────────────────────────────────────────────────────

/// Single place that answers "may this signed-in staff user see / do X on the
/// Expenses screens?" — a thin, pure wrapper over the permission list so the
/// gating matrix can be unit-tested.
///
/// **Unchanged from before the redesign**: the Menu tiles (`finance:view` +
/// the `expenses` feature flag), the route, and the analytics block (needs
/// `finance:view`; a 403 hides it). **Added** (web gates them the same way and
/// the key is seeded and is exactly the API route's `requirePermission`):
/// "Add expense" and the row Delete menu need `finance:expense-manage`.
class ExpenseAccess {
  const ExpenseAccess(this.user);

  static ExpenseAccess of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    return ExpenseAccess(s is SessionAuthenticatedStaff ? s.user : null);
  }

  final UserProfile? user;

  bool _has(String key) => user?.hasPermission(key) ?? false;

  /// `GET /expenses/analytics` (and `GET /expenses`).
  bool get canViewAnalytics => _has('finance:view');

  /// `POST /expenses`, `DELETE /expenses/:id`.
  bool get canManage => _has('finance:expense-manage');
}

// ── categories ──────────────────────────────────────────────────────────────

/// Colours per category — the same hues web's `EXPENSE_CATEGORY_META` uses
/// (chart-1 … chart-6 and muted for Other).
Color expenseCategoryColor(ExpenseCategory c) => switch (c) {
      ExpenseCategory.rent => TeamColors.indigo,
      ExpenseCategory.salary => TeamColors.violet,
      ExpenseCategory.utilities => TeamColors.amber,
      ExpenseCategory.equipment => TeamColors.rose,
      ExpenseCategory.maintenance => TeamColors.teal,
      ExpenseCategory.marketing => TeamColors.green,
      ExpenseCategory.officeSupplies => TeamColors.sky,
      ExpenseCategory.other => TeamColors.slate,
    };

IconData expenseCategoryIcon(ExpenseCategory c) => switch (c) {
      ExpenseCategory.rent => Icons.home_work_rounded,
      ExpenseCategory.salary => Icons.badge_rounded,
      ExpenseCategory.utilities => Icons.bolt_rounded,
      ExpenseCategory.equipment => Icons.fitness_center_rounded,
      ExpenseCategory.maintenance => Icons.build_rounded,
      ExpenseCategory.marketing => Icons.campaign_rounded,
      ExpenseCategory.officeSupplies => Icons.inventory_2_rounded,
      ExpenseCategory.other => Icons.more_horiz_rounded,
    };

/// Category chips web offers, in its order (UPPER_SNAKE api value, label).
List<(String, String)> get kExpenseCategoryOptions => [
      for (final c in ExpenseCategory.values) (c.apiValue, c.label),
    ];

String expenseCategoryLabelOf(String api) =>
    ExpenseCategoryX.fromApi(api).label;

Color expenseCategoryColorOf(String api) =>
    expenseCategoryColor(ExpenseCategoryX.fromApi(api));

/// Accent of the Expenses analytics (web's `EXPENSE_THEME.accent`).
const kExpenseAccent = TeamColors.rose;

// ── receipt ─────────────────────────────────────────────────────────────────

/// Opens a receipt's download URL (web's "Receipt" column link).
Future<void> openExpenseReceipt(BuildContext context, ExpenseEntry e) async {
  final uri = Uri.tryParse(e.receiptUrl ?? '');
  var ok = false;
  if (uri != null) {
    try {
      ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
  }
  if (!ok && context.mounted) {
    teamSnack(context, 'Could not open the receipt.', error: true);
  }
}

// ── entry card ──────────────────────────────────────────────────────────────

/// One expense: category glyph, description (or category), date, amount, and
/// the tags web's table columns carry (category, branch, receipt, recorded
/// by). When [onDelete] is given the card shows web's row menu with its single
/// Delete action.
class ExpenseEntryCard extends StatelessWidget {
  const ExpenseEntryCard({
    super.key,
    required this.entry,
    this.onDelete,
    this.onReceipt,
  });

  final ExpenseEntry entry;
  final VoidCallback? onDelete;
  final VoidCallback? onReceipt;

  @override
  Widget build(BuildContext context) {
    final color = expenseCategoryColor(entry.category);
    final hasDescription = entry.description?.isNotEmpty == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 8, 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      color,
                      Color.lerp(color, TeamColors.fuchsia, 0.4)!,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  expenseCategoryIcon(entry.category),
                  size: 19,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasDescription
                          ? entry.description!
                          : entry.category.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      incomeDay(entry.expenseDate),
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  money(entry.amount),
                  style: AppText.tabular(
                    size: 15,
                    weight: FontWeight.w800,
                    color: TeamColors.rose,
                  ),
                ),
              ),
              if (onDelete != null)
                SizedBox(
                  width: 34,
                  height: 30,
                  child: PopupMenuButton<String>(
                    key: ValueKey('expense-menu-${entry.id}'),
                    tooltip: 'Actions',
                    padding: EdgeInsets.zero,
                    color: AppColors.surface2,
                    icon: Icon(
                      Icons.more_vert_rounded,
                      size: 19,
                      color: AppColors.inkFaint,
                    ),
                    onSelected: (_) => onDelete!(),
                    itemBuilder: (_) => [
                      PopupMenuItem<String>(
                        value: 'delete',
                        child: Row(
                          children: [
                            const Icon(
                              Icons.delete_outline_rounded,
                              size: 18,
                              color: AppColors.danger,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Delete',
                              style: AppText.body(
                                size: 13,
                                weight: FontWeight.w700,
                                color: AppColors.danger,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              else
                const SizedBox(width: 6),
            ],
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                IncomeTag(label: entry.category.label, color: color),
                if (entry.branchName != null)
                  IncomeTag(
                    label: entry.branchName!,
                    color: TeamColors.sky,
                    icon: Icons.storefront_rounded,
                  ),
                if (entry.hasReceipt)
                  GestureDetector(
                    key: ValueKey('expense-receipt-${entry.id}'),
                    onTap: onReceipt,
                    child: IncomeTag(
                      label: entry.receiptFileName?.isNotEmpty == true
                          ? entry.receiptFileName!
                          : 'Receipt',
                      color: TeamColors.teal,
                      icon: Icons.attach_file_rounded,
                    ),
                  ),
                if (entry.recordedByName != null)
                  IncomeTag(
                    label: 'by ${entry.recordedByName}',
                    color: TeamColors.slate,
                    icon: Icons.person_outline_rounded,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

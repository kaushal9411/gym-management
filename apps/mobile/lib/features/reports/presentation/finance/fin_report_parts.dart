import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/member_payment.dart'
    show paymentMethodLabel, paymentStatusLabel;
import '../../../../models/report_summary.dart';
import '../../../../shared/widgets/list_hero.dart';
import '../../../expenses/presentation/expense_ui.dart'
    show expenseCategoryColorOf, expenseCategoryLabelOf;
import '../../../finance/presentation/payments_ui.dart' show PayColors;
import '../../../income/presentation/income_ui.dart' show incomeDay, IncomeTag;
import '../../../team/presentation/widgets/team_ui.dart';
import '../kit/kit.dart';

/// Shared pieces of the four financial report screens (Revenue, Expenses,
/// Payments, Branch performance): the paged-rows loader, the result card, the
/// detail sheet and the label / colour mappers for the summary breakdowns.

// -- summary breakdown labels & colours ------------------------------------

/// The summary API sends raw enums (`ONLINE_GATEWAY`, `OFFICE_SUPPLIES`,
/// `PARTIALLY_REFUNDED`); show the labels web's badges use.
String finBreakdownLabel(String key, String label) => switch (key) {
      'by-method' => paymentMethodLabel(label),
      'by-status' => paymentStatusLabel(label),
      'by-category' => expenseCategoryLabelOf(label),
      _ => label,
    };

/// Semantic colour per enum item (status green/amber/rose, per-method hue,
/// per-category hue); `null` keeps the kit's categorical colour.
Color? finBreakdownColor(String key, String label) => switch (key) {
      'by-method' => PayColors.method(label),
      'by-status' => PayColors.status(label),
      'by-category' => expenseCategoryColorOf(label),
      _ => null,
    };

IconData finMethodIcon(String method) => switch (method) {
      'CASH' => Icons.payments_rounded,
      'UPI' => Icons.qr_code_2_rounded,
      'CREDIT_CARD' || 'DEBIT_CARD' => Icons.credit_card_rounded,
      'BANK_TRANSFER' => Icons.account_balance_rounded,
      'CHEQUE' => Icons.edit_note_rounded,
      'ONLINE_GATEWAY' => Icons.language_rounded,
      _ => Icons.account_balance_wallet_rounded,
    };

/// `2026-10-18` -> `18 Oct 2026` (calendar day as sent, no timezone shift).
String finDate(String iso) {
  final d = DateTime.tryParse(iso.length > 10 ? iso.substring(0, 10) : iso);
  if (d == null) return iso;
  return incomeDay(DateTime.utc(d.year, d.month, d.day));
}

/// Hero chips from the first (up to three) numeric KPIs of the loaded
/// summary — web's `ReportViewer` builds its hero stats the same way —
/// falling back to [fallback] until the summary has loaded (or when it is
/// unavailable).
List<Widget> finHeroChips(ReportSummary? s, List<Widget> fallback) {
  if (s == null) return fallback;
  final chips = <Widget>[];
  for (final k in s.kpis) {
    if (chips.length == 3) break;
    if (k.format == SummaryFormat.text) continue;
    switch (k.format) {
      case SummaryFormat.money:
        chips.add(
          ListHeroChip(
            icon: Icons.payments_rounded,
            label: '${Formatters.currencyCompact(k.value)} · ${k.label}',
          ),
        );
      case SummaryFormat.percent:
        chips.add(
          ListHeroChip(
            icon: Icons.percent_rounded,
            label:
                '${rptFormatValue(RptFormat.percent, k.value * k.percentScale)}'
                ' · ${k.label}',
          ),
        );
      case SummaryFormat.number:
        chips.add(
          ListHeroChip(
            icon: Icons.tag_rounded,
            label: '${rptGrouped(k.value)} · ${k.label}',
          ),
        );
      case SummaryFormat.text:
        break;
    }
  }
  return chips.isEmpty ? fallback : chips;
}

// -- paged rows ------------------------------------------------------------

/// One loaded page of a list report.
class FinPage<T> {
  const FinPage({
    required this.items,
    required this.page,
    required this.total,
    required this.totalPages,
    this.totalAmount,
  });

  final List<T> items;
  final int page;
  final int total;
  final int totalPages;

  /// Period total sent by the revenue / expenses lists.
  final double? totalAmount;
}

/// Loads a report list page by page. Drops superseded responses (a filter
/// changed mid-flight), always resets its loading flags and keeps the first
/// error as a message for the retry view.
class FinRowsLoader<T> extends ChangeNotifier {
  FinRowsLoader(this._fetch);

  final Future<FinPage<T>> Function(int page) _fetch;

  final List<T> items = [];
  int page = 1;
  int total = 0;
  int totalPages = 1;
  double? totalAmount;

  /// True from the start so the first frame shows the loading state, not an
  /// empty list.
  bool loading = true;
  bool loadingMore = false;
  String? error;

  /// Message of the last failed "Load more" (the screen snackbars it).
  String? moreError;
  int _gen = 0;
  bool _disposed = false;

  bool get hasMore => page < totalPages;

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  /// Fetches page 1, replacing everything.
  Future<void> reload() async {
    final gen = ++_gen;
    loading = true;
    loadingMore = false;
    error = null;
    _emit();
    try {
      final p = await _fetch(1);
      if (gen != _gen) return;
      items
        ..clear()
        ..addAll(p.items);
      page = p.page;
      total = p.total;
      totalPages = p.totalPages;
      totalAmount = p.totalAmount;
    } on ApiException catch (e) {
      if (gen != _gen) return;
      items.clear();
      error = e.detailedMessage;
    } catch (e) {
      if (gen != _gen) return;
      items.clear();
      error = 'Something went wrong. Please try again.';
    } finally {
      if (gen == _gen) {
        loading = false;
        _emit();
      }
    }
  }

  /// Appends the next page.
  Future<void> more() async {
    if (loading || loadingMore || !hasMore) return;
    final gen = _gen;
    loadingMore = true;
    moreError = null;
    _emit();
    try {
      final p = await _fetch(page + 1);
      if (gen != _gen) return;
      items.addAll(p.items);
      page = p.page;
      total = p.total;
      totalPages = p.totalPages;
    } on ApiException catch (e) {
      if (gen == _gen) moreError = e.detailedMessage;
    } catch (e) {
      if (gen == _gen) moreError = 'Could not load more. Please try again.';
    } finally {
      if (gen == _gen) {
        loadingMore = false;
        _emit();
      }
    }
  }

  /// Forgets everything and cancels in-flight loads (invalid date range).
  void clear() {
    _gen++;
    items.clear();
    page = 1;
    total = 0;
    totalPages = 1;
    totalAmount = null;
    loading = false;
    loadingMore = false;
    error = null;
    _emit();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

// -- result card -----------------------------------------------------------

/// One result row: gradient glyph (or [leading]), title, subtitle lines,
/// amount on the right and a wrap of [tags]. Tapping opens the detail sheet.
class FinRowCard extends StatelessWidget {
  const FinRowCard({
    super.key,
    required this.color,
    required this.title,
    this.icon,
    this.leading,
    this.subtitle,
    this.caption,
    this.amount,
    this.amountColor,
    this.tags = const [],
    this.onTap,
    this.index = 0,
  });

  final Color color;
  final IconData? icon;
  final Widget? leading;
  final String title;
  final String? subtitle;
  final String? caption;
  final String? amount;
  final Color? amountColor;
  final List<Widget> tags;
  final VoidCallback? onTap;
  final int index;

  @override
  Widget build(BuildContext context) {
    final glyph = leading ??
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.4)!],
            ),
            borderRadius: BorderRadius.circular(13),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.28),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(
            icon ?? Icons.receipt_long_rounded,
            size: 20,
            color: Colors.white,
          ),
        );
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              glyph,
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                    if (caption != null) ...[
                      const SizedBox(height: 1),
                      Text(
                        caption!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (amount != null) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    amount!,
                    maxLines: 1,
                    style: AppText.tabular(
                      size: 15,
                      weight: FontWeight.w800,
                      color: amountColor ?? color,
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (tags.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: tags,
            ),
          ],
        ],
      ),
    );
    return RptReveal(
      index: index.clamp(0, 6),
      child: Material(
        color: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
          side: BorderSide(color: AppColors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: onTap == null ? body : InkWell(onTap: onTap, child: body),
      ),
    );
  }
}

/// Small coloured tag used inside result cards.
Widget finTag(String label, Color color, {IconData? icon}) =>
    IncomeTag(label: label, color: color, icon: icon);

// -- detail sheet ----------------------------------------------------------

/// Bottom sheet with every field of one report row (the phone's stand-in for
/// web's table columns): big [amount], optional [tags], then label / value
/// rows. Capped at 640 dp on tablets by [showTeamSheet].
Future<void> showFinDetailSheet(
  BuildContext context, {
  required IconData icon,
  required String title,
  required Color color,
  required List<(String, String)> rows,
  String? subtitle,
  String? amount,
  List<Widget> tags = const [],
}) {
  return showTeamSheet<void>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: icon,
      title: title,
      subtitle: subtitle,
      color: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (amount != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    color.withValues(alpha: 0.20),
                    color.withValues(alpha: 0.06),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: color.withValues(alpha: 0.30)),
              ),
              child: Text(
                amount,
                style: AppText.display(size: 26, color: color),
              ),
            ),
          if (tags.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Wrap(spacing: 6, runSpacing: 6, children: tags),
            ),
          for (var i = 0; i < rows.length; i++)
            _SheetRow(label: rows[i].$1, value: rows[i].$2, first: i == 0),
        ],
      ),
    ),
  );
}

class _SheetRow extends StatelessWidget {
  const _SheetRow({
    required this.label,
    required this.value,
    required this.first,
  });

  final String label;
  final String value;
  final bool first;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        border: first ? null : Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 12.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              textAlign: TextAlign.right,
              style: AppText.body(size: 13, weight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

/// A `ReportSummaryFilters` for the controller's current range (local days,
/// `YYYY-MM-DD`; parsed back to a local midnight so the repository formats
/// the same day).
ReportSummaryFilters finSummaryFilters(
  RptPeriodController c, {
  String? paymentStatus,
}) {
  final r = c.range;
  return ReportSummaryFilters(
    from: DateTime.parse(r.from),
    to: DateTime.parse(r.to),
    branchId: c.branchId,
    paymentStatus: paymentStatus,
  );
}

/// Hook for screens: `unawaited` shorthand that keeps lints quiet.
void finFire(Future<void> f) => unawaited(f);

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_payment.dart'
    show paymentMethodLabel, paymentStatusLabel, paymentStatusValues;
import '../../../models/payment_report_row.dart';
import '../../../models/report_summary.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../finance/presentation/payments_ui.dart'
    show PayAvatar, PayColors, payMethodTag, payMoney, payStatusTag;
import 'finance/fin_report_parts.dart';
import 'finance/fin_report_state.dart';
import 'kit/kit.dart';

/// Report type id (`GET /reports/payments`, `/reports/payments/summary`, the
/// export endpoint `GET /reports/payments/export`).
const kPaymentReportType = 'payments';

/// Reports Center's "Payment Report" — every payment with its status, on the
/// report kit like web's `ReportViewer`:
///
///  * hero chips = the first three summary KPIs (Total collected / Payments /
///    Success rate), falling back to the result count and the range;
///  * [RptPeriodBar] (period, custom range <= 366 days, branch, compare) and
///    web's **Status** chips (All + all six payment statuses; the old screen
///    stopped at four);
///  * `GET /reports/payments/summary` via [RptSummaryPanel]: KPIs with
///    deltas, "Daily collected" trend (Daily / Cumulative, dashed previous
///    period), the "Payments by status" donut (status colours) and the
///    "Collected by method" donut. The summary follows the status filter
///    exactly like the list;
///  * the result rows (web's table: number, member id, name, branch, amount,
///    method, status, date) as cards with Load more and a detail sheet.
///
/// Export: the hero "Export" pill + the results-header icon (CSV / Excel / PDF
/// / Print, `reports:export`) via `exportSpec`, with the period, branch and
/// status the screen shows. Dropped vs web: numbered pagination.
/// Rows do not open the payment detail screen — the report rows carry no
/// payment id. Permissions unchanged (hub tile `reports:view`; summary hides
/// itself without it / on 403).
class PaymentReportScreen extends StatefulWidget {
  const PaymentReportScreen({super.key});

  @override
  State<PaymentReportScreen> createState() => _PaymentReportScreenState();
}

class _PaymentReportScreenState extends State<PaymentReportScreen>
    with FinReportState<PaymentReportScreen, PaymentReportRow> {
  ReportSummary? _summary;

  /// API enum (`SUCCESS`) or null for "All".
  String? _status;

  @override
  void initState() {
    super.initState();
    initFin();
  }

  @override
  void dispose() {
    disposeFin();
    super.dispose();
  }

  @override
  String get extraScope => _status ?? '';

  @override
  Future<FinPage<PaymentReportRow>> fetchPage(int page) async {
    final d = rangeDates;
    final r = await getIt<ReportsRepository>().payments(
      from: d.from,
      to: d.to,
      branchId: controls.branchId,
      paymentStatus: _status,
      page: page,
    );
    return FinPage(
      items: r.items,
      page: r.page,
      total: r.total,
      totalPages: r.totalPages,
    );
  }

  void _setStatus(String? s) {
    _status = s;
    filtersChanged();
  }

  List<Widget> get _fallbackChips => [
        if (!rows.loading && rows.error == null)
          ListHeroChip(
            icon: Icons.receipt_long_rounded,
            label: '${rows.total} payments',
          ),
        ListHeroChip(
          icon: Icons.date_range_rounded,
          label: '${rptShortDate(controls.range.from)} – '
              '${rptShortDate(controls.range.to)}',
        ),
      ];

  void _open(PaymentReportRow r) {
    final color = PayColors.status(r.status);
    showFinDetailSheet(
      context,
      icon: PayColors.statusIcon(r.status),
      title: r.name,
      subtitle: '#${r.paymentNumber}',
      color: color,
      amount: payMoney(r.finalAmount),
      tags: [payStatusTag(r.status), payMethodTag(r.method)],
      rows: [
        ('Payment #', r.paymentNumber),
        ('Member ID', r.memberCode),
        ('Name', r.name),
        ('Branch', r.branch),
        ('Amount', payMoney(r.finalAmount)),
        ('Method', paymentMethodLabel(r.method)),
        ('Status', paymentStatusLabel(r.status)),
        ('Date', finDate(r.paymentDate)),
      ],
    );
  }

  Widget _filters() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RptPeriodBar(controller: controls, accent: RptColors.green),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('STATUS', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              RptFilterChips<String>(
                color: RptColors.green,
                value: _status ?? '',
                onChanged: (v) => _setStatus(v.isEmpty ? null : v),
                chips: [
                  const RptChip<String>('', 'All'),
                  for (final s in paymentStatusValues)
                    RptChip<String>(
                      s,
                      paymentStatusLabel(s),
                      dot: PayColors.status(s),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final ready = controls.rangeReady;
    return RptViewerScaffold<PaymentReportRow>(
      title: 'Payment Report',
      subtitle: _status == null
          ? 'Every payment, with status'
          : '${paymentStatusLabel(_status!)} payments',
      heroChips: finHeroChips(_summary, _fallbackChips),
      filters: _filters(),
      summary: ready
          ? RptSummaryPanel(
              key: ValueKey('payments-summary-$refreshTick'),
              type: kPaymentReportType,
              filters: finSummaryFilters(controls, paymentStatus: _status),
              accent: RptAccent.finance,
              compare: controls.compare,
              labelFor: finBreakdownLabel,
              colorFor: finBreakdownColor,
              onLoaded: (s) {
                if (mounted) setState(() => _summary = s);
              },
            )
          : null,
      resultsTitle: 'Payments',
      exportSpec: RptExportSpec(
        reportType: kPaymentReportType,
        title: 'Payment Report',
        filters: () => finSummaryFilters(controls, paymentStatus: _status),
        enabled: ready,
      ),
      items: rows.items,
      total: rows.total,
      loading: rows.loading,
      error: rows.error,
      onRetry: () => rows.reload(),
      hasMore: rows.hasMore,
      loadingMore: rows.loadingMore,
      onLoadMore: rows.more,
      onRefresh: refreshAll,
      emptyTitle: 'No payments found',
      emptyMessage: ready
          ? 'Try a different range or filter.'
          : 'Pick a valid date range (start before end, up to 366 days).',
      emptyIcon: Icons.receipt_long_outlined,
      itemBuilder: (context, r, i) => FinRowCard(
        index: i,
        color: PayColors.status(r.status),
        leading: PayAvatar(name: r.name, seed: r.memberCode, size: 40),
        title: r.name,
        subtitle: '#${r.paymentNumber} · ${r.memberCode}',
        caption: '${finDate(r.paymentDate)} · ${r.branch}',
        amount: payMoney(r.finalAmount),
        amountColor: PayColors.status(r.status),
        tags: [payStatusTag(r.status), payMethodTag(r.method)],
        onTap: () => _open(r),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/billing_payment.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'billing_ui.dart';

/// web's `FILTERS` on the History page, `(value, label)`.
const kPaymentFilters = [
  ('ALL', 'All'),
  ('SUCCEEDED', 'Succeeded'),
  ('PENDING', 'Pending'),
  ('FAILED', 'Failed'),
  ('REFUNDED', 'Refunded'),
];

/// Everything the History page derives from the payment array (web's
/// `derived` + `counts` memos), as a pure class so it can be unit-tested.
class PaymentHistoryStats {
  PaymentHistoryStats._({
    required this.currency,
    required this.total,
    required this.paidCount,
    required this.failed,
    required this.last,
    required this.points,
    required this.counts,
  });

  /// Currency of the first (newest) payment; money totals only add payments
  /// in this currency, exactly like web.
  final String currency;
  final double total;
  final int paidCount;
  final int failed;
  final BillingPayment? last;
  final List<SpendPoint> points;

  /// `ALL` plus per-status counts (`PARTIALLY_REFUNDED` counts as
  /// `REFUNDED`).
  final Map<String, int> counts;

  factory PaymentHistoryStats.from(List<BillingPayment> list) {
    final paid = list.where((p) => p.isSucceeded).toList();
    final currency = list.isEmpty ? 'USD' : list.first.currency;
    final same = paid.where((p) => p.currency == currency).toList();
    final total = same.fold<double>(0, (s, p) => s + p.amount);
    BillingPayment? last;
    for (final p in paid) {
      if (last == null || p.createdAt.isAfter(last.createdAt)) last = p;
    }
    // Spend by *local* calendar month, chronological.
    final byMonth = <(int, int), double>{};
    for (final p in same) {
      final d = p.createdAt.toLocal();
      byMonth.update(
        (d.year, d.month),
        (v) => v + p.amount,
        ifAbsent: () => p.amount,
      );
    }
    final keys = byMonth.keys.toList()
      ..sort(
        (a, b) => a.$1 != b.$1 ? a.$1.compareTo(b.$1) : a.$2.compareTo(b.$2),
      );
    final counts = <String, int>{'ALL': list.length};
    for (final p in list) {
      final key = p.status == 'PARTIALLY_REFUNDED' ? 'REFUNDED' : p.status;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return PaymentHistoryStats._(
      currency: currency,
      total: total,
      paidCount: paid.length,
      failed: list.where((p) => p.isFailed).length,
      last: last,
      points: [
        for (final k in keys)
          SpendPoint(
            label: billingMonthLabel(k.$1, k.$2),
            amount: byMonth[k]!,
          ),
      ],
      counts: counts,
    );
  }
}

/// web's filter predicate: `REFUNDED` also matches `PARTIALLY_REFUNDED`.
bool paymentMatchesFilter(BillingPayment p, String filter) =>
    filter == 'ALL' ||
    (filter == 'REFUNDED' ? p.isRefunded : p.status == filter);

/// Billing History — web's `/billing/history` ("Payment attempts"): every
/// charge attempt for the gym's own subscription (`GET /payment/history`,
/// `billing:read`), newest first.
///
/// Same order as web: gradient `ListHero` (total paid + payment count), the
/// four summary tiles (Total paid / Payments / Last payment / Failed), the
/// "Spend over time" monthly bars (successful payments, the first payment's
/// currency), then "Payment attempts" with the status chips and counts (All /
/// Succeeded / Pending / Failed / Refunded) and one card per attempt (date,
/// provider, failure reason, status, amount). The endpoint is not paginated,
/// so — like web — everything is filtered client-side.
///
/// Before the redesign this route showed the subscription *invoices*; those
/// are now their own screen (`BillingInvoicesScreen`, web's Invoices page),
/// reached from the hub tile. Nothing is gated per permission (menu tile
/// `billing:read` only), as before.
///
/// **Dropped vs web**: chart hover tooltip (tap a bar instead).
class BillingHistoryScreen extends StatefulWidget {
  const BillingHistoryScreen({super.key});

  @override
  State<BillingHistoryScreen> createState() => _BillingHistoryScreenState();
}

class _BillingHistoryScreenState extends State<BillingHistoryScreen> {
  List<BillingPayment>? _payments;
  PaymentHistoryStats? _stats;
  String? _error;
  bool _loading = true;
  String _filter = 'ALL';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final list = await getIt<BillingRepository>().paymentHistory();
      if (!mounted) return;
      setState(() {
        _payments = list;
        _stats = PaymentHistoryStats.from(list);
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted && _payments == null) setState(() => _error = e.message);
    } catch (e) {
      if (mounted && _payments == null) {
        setState(() => _error = 'Could not load payments ($e)');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appName = context.watch<PlatformConfigCubit>().state.appName;
    final top = MediaQuery.of(context).padding.top;
    final stats = _stats;
    final payments = _payments;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: ListHero(
                title: 'Billing History',
                subtitle: 'Every payment attempt for your $appName '
                    'subscription.',
                topInset: top,
                side: 18 + teamSideInset(context),
                leading: ListHeroButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.pop(),
                ),
                chips: [
                  if (stats != null) ...[
                    ListHeroChip(
                      icon: Icons.account_balance_wallet_rounded,
                      label: '${billingMoney(stats.total, stats.currency)} '
                          'paid',
                    ),
                    ListHeroChip(
                      icon: Icons.tag_rounded,
                      label: '${payments!.length} '
                          '${payments.length == 1 ? 'payment' : 'payments'}',
                    ),
                  ],
                ],
              ),
            ),
            if (_error != null && payments == null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: AppErrorView(message: _error!, onRetry: _load),
              )
            else ...[
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        BillingKpiGrid(
                          loading: _loading && stats == null,
                          tiles: _kpis(stats),
                        ),
                        const SizedBox(height: 14),
                        TeamSectionCard(
                          icon: Icons.bar_chart_rounded,
                          color: TeamColors.indigo,
                          title: 'Spend over time',
                          subtitle: 'Successful payments by month',
                          child: stats == null
                              ? const SizedBox(height: 120)
                              : stats.points.isEmpty
                                  ? Padding(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 24,
                                      ),
                                      child: Center(
                                        child: Text(
                                          'No successful payments to chart '
                                          'yet.',
                                          style: AppText.body(
                                            size: 12.5,
                                            color: AppColors.inkFaint,
                                            weight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    )
                                  : BillingSpendChart(
                                      points: stats.points,
                                      currency: stats.currency,
                                    ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          'Payment attempts',
                          style: AppText.display(size: 17),
                        ),
                        if (payments != null && payments.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          BillingFilterChips(
                            options: kPaymentFilters,
                            current: _filter,
                            counts: stats!.counts,
                            onChanged: (v) => setState(() => _filter = v),
                          ),
                        ],
                        const SizedBox(height: 12),
                      ],
                    ),
                  ),
                ),
              ),
              ..._list(payments),
            ],
          ],
        ),
      ),
    );
  }

  List<BillingKpi> _kpis(PaymentHistoryStats? s) {
    final last = s?.last;
    return [
      BillingKpi(
        icon: Icons.account_balance_wallet_rounded,
        label: 'Total paid',
        value: s == null ? '' : billingMoney(s.total, s.currency),
        hint: s == null ? null : '${s.paidCount} successful',
        color: TeamColors.indigo,
      ),
      BillingKpi(
        icon: Icons.tag_rounded,
        label: 'Payments',
        value: '${_payments?.length ?? 0}',
        hint: 'All attempts',
        color: TeamColors.teal,
      ),
      BillingKpi(
        icon: Icons.event_available_rounded,
        label: 'Last payment',
        value: last == null ? '—' : billingDate(last.createdAt),
        hint: last == null
            ? 'None yet'
            : billingMoney(last.amount, last.currency),
        color: TeamColors.violet,
      ),
      BillingKpi(
        icon: Icons.warning_amber_rounded,
        label: 'Failed',
        value: '${s?.failed ?? 0}',
        hint: 'Failed attempts',
        color: TeamColors.rose,
      ),
    ];
  }

  List<Widget> _list(List<BillingPayment>? payments) {
    if (payments == null) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: AppLoadingView(),
          ),
        ),
      ];
    }
    if (payments.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: TeamCenter(
            child: const Padding(
              padding: EdgeInsets.fromLTRB(18, 0, 18, 32),
              child: BillingEmptyBlock(
                icon: Icons.receipt_long_rounded,
                title: 'No payment attempts yet',
                message: 'Payments for your subscription will appear here.',
              ),
            ),
          ),
        ),
      ];
    }
    final visible = [
      for (final p in payments)
        if (paymentMatchesFilter(p, _filter)) p,
    ];
    if (visible.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
            child: Center(
              child: Text(
                'No payments match this filter.',
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ];
    }
    return [
      teamCardSliver<BillingPayment>(
        context,
        items: visible,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (p, i) => PaymentAttemptCard(
          key: ValueKey('payment-${p.id}'),
          payment: p,
        ),
      ),
    ];
  }
}

/// One payment attempt: status glyph, provider + local date/time (and the
/// failure reason in red), amount (2 decimals) and status pill — web's table
/// row as a card.
class PaymentAttemptCard extends StatelessWidget {
  const PaymentAttemptCard({super.key, required this.payment});

  final BillingPayment payment;

  @override
  Widget build(BuildContext context) {
    final color = billingStatusColor(payment.status);
    final icon = switch (payment.status) {
      'SUCCEEDED' => Icons.check_rounded,
      'FAILED' => Icons.close_rounded,
      'PENDING' => Icons.schedule_rounded,
      _ => Icons.undo_rounded,
    };
    final provider = payment.provider.isEmpty
        ? 'Payment'
        : payment.provider[0].toUpperCase() + payment.provider.substring(1);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.4)!],
              ),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(icon, size: 19, color: Colors.white),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  provider,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  billingDateTime(payment.createdAt),
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                if (payment.failureReason != null &&
                    payment.failureReason!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      payment.failureReason!,
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.danger,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                billingMoney(payment.amount, payment.currency, decimals: 2),
                style: AppText.tabular(size: 14.5, weight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              BillingStatusPill(status: payment.status),
            ],
          ),
        ],
      ),
    );
  }
}

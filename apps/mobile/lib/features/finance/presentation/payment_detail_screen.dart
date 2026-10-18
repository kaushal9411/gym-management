import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_payment.dart';
import '../../../repositories/payment_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroShell;
import '../../team/presentation/widgets/team_ui.dart';
import 'payment_actions.dart';
import 'payments_ui.dart';
import 'widgets/refund_sheet.dart';

/// Web's `/payments/[paymentId]` page: gradient hero (number, status, amount,
/// member · plan · branch · method, View invoice / Refund), four summary tiles
/// (Amount paid, Refunded, Refundable balance, Net received), the Payment
/// details card (member, plan, branch, recorded by, invoice, method,
/// reference, gross / discount / tax, date, notes), the Activity timeline, the
/// Refund split ring, "Other payments by the member" and the Manage card
/// (Verify gateway status, Cancel payment).
///
/// Gating (all hide the control rather than failing): **Refund** needs
/// `finance:payment-refund` and a SUCCESS / PARTIALLY_REFUNDED payment with a
/// balance (as before); **Verify** and **Cancel** need
/// `finance:payment-create` — web's key and the routes' `requirePermission`
/// (Cancel is additionally hidden once a refund exists, as before); **View
/// invoice** needs `finance:invoice-view`. After a refund / cancel / verify
/// the payment is re-fetched (`cancel` responds with `data: null`).
///
/// **Dropped vs web**: the member name is not a link (the Member page is a
/// different feature behind `members:view`), and the hero keeps the status as
/// a pill instead of web's separate badge.
class PaymentDetailScreen extends StatefulWidget {
  const PaymentDetailScreen({required this.paymentId, super.key});

  final String paymentId;

  @override
  State<PaymentDetailScreen> createState() => _PaymentDetailScreenState();
}

class _PaymentDetailScreenState extends State<PaymentDetailScreen> {
  MemberPayment? _payment;
  bool _busy = false;
  String? _error;
  List<MemberPayment>? _others;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final payment =
          await getIt<PaymentRepository>().getById(widget.paymentId);
      if (!mounted) return;
      setState(() => _payment = payment);
      unawaited(_loadOthers(payment));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this payment ($e)');
    }
  }

  /// Other payments by the same member (web: `memberId` filter, latest 6, the
  /// current one dropped, 4 shown). Optional — a failure just hides the list.
  Future<void> _loadOthers(MemberPayment p) async {
    if (p.memberId.isEmpty) {
      if (mounted) setState(() => _others = const []);
      return;
    }
    try {
      final r = await getIt<PaymentRepository>().list(
        memberId: p.memberId,
        limit: 6,
      );
      if (!mounted) return;
      setState(
        () => _others = r.items.where((x) => x.id != p.id).take(4).toList(),
      );
    } catch (_) {
      if (mounted) setState(() => _others = const []);
    }
  }

  Future<void> _refund() async {
    final payment = _payment;
    if (payment == null) return;
    final result = await showRefundSheet(context, payment);
    if (result == null || !mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await getIt<PaymentRepository>().refund(
        payment.id,
        amount: result.amount,
        reason: result.reason,
      );
      // Re-fetch rather than trust the action response: the detail DTO is
      // what carries the refunds[] history and the recomputed status.
      final updated = await getIt<PaymentRepository>().getById(payment.id);
      if (!mounted) return;
      setState(() => _payment = updated);
      unawaited(_loadOthers(updated));
      teamSnack(context, 'Refund recorded.');
    } on ApiException catch (e) {
      if (!mounted) return;
      teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (!mounted) return;
      teamSnack(context, 'Could not record the refund ($e)', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final payment = _payment;
    if (payment == null) return;
    final confirmed = await confirmTeam(
      context,
      title: 'Cancel payment ${payment.paymentNumber}?',
      message: '${payment.paymentNumber} for ${payment.memberName} will be '
          'marked cancelled. This cannot be undone.',
      confirmLabel: 'Cancel payment',
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await getIt<PaymentRepository>().cancel(payment.id);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      teamSnack(context, 'Payment cancelled.');
    } on ApiException catch (e) {
      if (!mounted) return;
      teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (!mounted) return;
      teamSnack(context, 'Could not cancel the payment ($e)', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final payment = _payment;
    if (payment == null) return;
    setState(() => _busy = true);
    final status = await verifyPaymentStatus(context, payment.id);
    if (!mounted) return;
    if (status != null) await _load();
    if (mounted) setState(() => _busy = false);
  }

  void _viewInvoice(MemberPayment p) =>
      context.push(AppRoutes.invoiceDetail, extra: p.invoiceId);

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final p = _payment;
    final hero = p != null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Payment' : 'Payments'),
      ),
      body: SafeArea(
        top: false,
        child: p == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : _content(p),
      ),
    );
  }

  Widget _content(MemberPayment p) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final color = PayColors.status(p.status);
    final canRefund = p.canRefund && teamCan(context, PayPerm.refund);
    final canInvoice =
        p.invoiceId != null && teamCan(context, PayPerm.invoiceView);
    final canManage = teamCan(context, PayPerm.create);

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          PlanHeroShell(
            topInset: top,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: Text(
                    'PAYMENT · ${payDate(p.paymentDate)}',
                    style: AppText.eyebrow(
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                FadeUp(
                  index: 1,
                  child: Text(
                    p.paymentNumber,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 28, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 8),
                FadeUp(
                  index: 2,
                  child: PayMoneyCount(
                    value: p.finalAmount,
                    style: AppText.display(size: 36, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 6),
                FadeUp(
                  index: 3,
                  child: Text(
                    [
                      p.memberName,
                      if (p.planName != null) p.planName!,
                      if (p.branchName.isNotEmpty) p.branchName,
                      paymentMethodLabel(p.method),
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 4,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      TeamHeroPill(paymentStatusLabel(p.status), dot: color),
                      TeamHeroPill(
                        paymentMethodLabel(p.method),
                        icon: Icons.account_balance_wallet_rounded,
                      ),
                      if (p.refunds.isNotEmpty)
                        TeamHeroPill(
                          '${p.refunds.length} refund'
                          '${p.refunds.length == 1 ? '' : 's'}',
                          icon: Icons.undo_rounded,
                        ),
                    ],
                  ),
                ),
                if (canInvoice || canRefund) ...[
                  const SizedBox(height: 14),
                  FadeUp(
                    index: 5,
                    child: Row(
                      children: [
                        if (canInvoice)
                          TeamHeroAction(
                            label: 'View invoice',
                            icon: Icons.description_rounded,
                            onTap: () => _viewInvoice(p),
                          ),
                        if (canInvoice && canRefund) const SizedBox(width: 8),
                        if (canRefund)
                          TeamHeroAction(
                            label: 'Refund payment',
                            icon: Icons.undo_rounded,
                            onTap: _busy ? null : _refund,
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context),
              14,
              16 + teamSideInset(context),
              0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _tiles(p),
                const SizedBox(height: 14),
                _columns(p, canInvoice: canInvoice, canManage: canManage),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tiles(MemberPayment p) {
    final refunded = p.totalRefunded;
    String pct(double v) =>
        p.finalAmount > 0 ? '${(v / p.finalAmount * 100).round()}%' : '0%';
    final refundable = p.refundableShown;
    return TeamSummaryGrid(
      tiles: [
        TeamSummaryTile(
          index: 0,
          icon: Icons.payments_rounded,
          color: TeamColors.indigo,
          label: 'Amount paid',
          text: payMoney(p.finalAmount),
          hint: p.tax > 0 ? 'incl. ${payMoney(p.tax)} tax' : 'no tax applied',
        ),
        TeamSummaryTile(
          index: 1,
          icon: Icons.undo_rounded,
          color: refunded > 0 ? TeamColors.rose : TeamColors.slate,
          label: 'Refunded',
          text: payMoney(refunded),
          hint: '${pct(refunded)} · ${p.refunds.length} '
              'refund${p.refunds.length == 1 ? '' : 's'}',
        ),
        TeamSummaryTile(
          index: 2,
          icon: Icons.savings_rounded,
          color: refundable > 0 ? TeamColors.green : TeamColors.slate,
          label: 'Refundable balance',
          text: payMoney(refundable),
          hint: refundable > 0
              ? '${pct(refundable)} remaining'
              : 'nothing left to refund',
        ),
        TeamSummaryTile(
          index: 3,
          icon: Icons.account_balance_rounded,
          color: TeamColors.teal,
          label: 'Net received',
          text: payMoney(p.netReceived),
          hint: p.isReceived ? 'after refunds' : 'not received yet',
        ),
      ],
    );
  }

  /// Two columns on a wide screen (details + timeline | split + others +
  /// manage), one stacked column on a phone.
  Widget _columns(
    MemberPayment p, {
    required bool canInvoice,
    required bool canManage,
  }) {
    final left = [_details(p, canInvoice), _timeline(p)];
    final right = [
      _split(p),
      _otherPayments(p),
      if (canManage) _manage(p),
    ];
    return LayoutBuilder(
      builder: (context, c) {
        Widget stack(List<Widget> items) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(height: 14),
                  FadeUp(index: i, child: items[i]),
                ],
              ],
            );
        if (c.maxWidth < 720) return stack([...left, ...right]);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 3, child: stack(left)),
            const SizedBox(width: 14),
            Expanded(flex: 2, child: stack(right)),
          ],
        );
      },
    );
  }

  Widget _details(MemberPayment p, bool canInvoice) {
    return TeamSectionCard(
      icon: Icons.receipt_long_rounded,
      color: TeamColors.indigo,
      title: 'Payment details',
      child: Column(
        children: [
          PayInfoRow(
            first: true,
            label: 'Member',
            value: '${p.memberName} · ${p.memberCode}',
          ),
          PayInfoRow(label: 'Plan', value: p.planName),
          PayInfoRow(label: 'Branch', value: p.branchName),
          PayInfoRow(label: 'Recorded by', value: p.recordedByName),
          if (p.invoiceId != null)
            PayInfoRow(
              label: 'Invoice',
              child: canInvoice
                  ? GestureDetector(
                      onTap: () => _viewInvoice(p),
                      child: Text(
                        'View invoice',
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w800,
                          color: TeamColors.indigo,
                        ),
                      ),
                    )
                  : Text(
                      'Linked',
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
            ),
          PayInfoRow(label: 'Method', value: paymentMethodLabel(p.method)),
          PayInfoRow(label: 'Reference', value: p.reference),
          PayInfoRow(
            label: 'Gross / discount / tax',
            value: '${payMoney(p.amount)} / ${payMoney(p.discount)} / '
                '${payMoney(p.tax)}',
          ),
          PayInfoRow(label: 'Payment date', value: payDate(p.paymentDate)),
          PayInfoRow(label: 'Notes', value: p.notes),
        ],
      ),
    );
  }

  Widget _timeline(MemberPayment p) {
    final refunds = [...p.refunds]
      ..sort((a, b) => b.refundedAt.compareTo(a.refundedAt));
    final baseTitle = p.isReceived
        ? 'Payment received'
        : switch (p.status) {
            'PENDING' => 'Payment pending',
            'FAILED' => 'Payment failed',
            _ => 'Payment cancelled',
          };
    final events = <({Color color, String title, String sub})>[
      for (final r in refunds)
        (
          color: TeamColors.fuchsia,
          title: 'Refunded ${payMoney(r.amount)}',
          sub: [
            if (r.reason != null && r.reason!.isNotEmpty) '“${r.reason}”',
            if (r.refundedByName != null) 'by ${r.refundedByName}',
            payDateTime(r.refundedAt),
          ].join(' · '),
        ),
      (
        color: p.isReceived ? TeamColors.green : PayColors.status(p.status),
        title: '$baseTitle ${payMoney(p.finalAmount)}',
        sub: 'via ${paymentMethodLabel(p.method)}'
            '${p.createdAt != null ? ' · ${payDateTime(p.createdAt!)}' : ''}',
      ),
    ];
    return TeamSectionCard(
      icon: Icons.timeline_rounded,
      color: TeamColors.violet,
      title: 'Activity timeline',
      trailing: TeamTag(
        label: '${events.length} event${events.length == 1 ? '' : 's'}',
        color: TeamColors.violet,
      ),
      child: Column(
        children: [
          for (var i = 0; i < events.length; i++)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Column(
                    children: [
                      const SizedBox(height: 4),
                      Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: events[i].color,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: events[i].color.withValues(alpha: 0.3),
                            width: 3,
                          ),
                        ),
                      ),
                      if (i < events.length - 1)
                        Expanded(
                          child: Container(width: 2, color: AppColors.line),
                        ),
                    ],
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        bottom: i < events.length - 1 ? 16 : 2,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            events[i].title,
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            events[i].sub,
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _split(MemberPayment p) {
    final fin = p.finalAmount;
    final refunded = p.totalRefunded > fin ? fin : p.totalRefunded;
    final kept = (fin - refunded) < 0 ? 0.0 : fin - refunded;
    final frac = fin > 0 ? refunded / fin : 0.0;
    return TeamSectionCard(
      icon: Icons.donut_large_rounded,
      color: TeamColors.fuchsia,
      title: 'Refund split',
      child: Column(
        children: [
          AnimatedRing(
            value: frac,
            size: 130,
            stroke: 16,
            colors: const [TeamColors.fuchsia, TeamColors.rose],
            track: TeamColors.green.withValues(alpha: 0.45),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${(frac * 100).round()}%',
                  style: AppText.display(size: 22),
                ),
                Text('REFUNDED', style: AppText.eyebrow()),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 16,
            runSpacing: 6,
            children: [
              _dot(TeamColors.green, 'Kept ${payMoney(kept)}'),
              _dot(TeamColors.fuchsia, 'Refunded ${payMoney(refunded)}'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _dot(Color c, String t) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: c, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(t, style: AppText.body(size: 12.5, weight: FontWeight.w800)),
        ],
      );

  Widget _otherPayments(MemberPayment p) {
    final first = p.memberName.trim().split(RegExp(r'\s+')).first;
    final others = _others;
    return TeamSectionCard(
      icon: Icons.history_rounded,
      color: TeamColors.teal,
      title: 'Other payments by $first',
      child: others == null
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: LinearProgressIndicator(color: AppColors.staffB),
            )
          : others.isEmpty
              ? const PayEmptyNote('No other payments from this member.')
              : Column(
                  children: [
                    for (var i = 0; i < others.length; i++)
                      InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => context.push(
                          AppRoutes.paymentDetail,
                          extra: others[i].id,
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            border: i == 0
                                ? null
                                : Border(
                                    top: BorderSide(color: AppColors.line),
                                  ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  others[i].paymentNumber,
                                  style: AppText.tabular(
                                    size: 13,
                                    color: TeamColors.indigo,
                                    weight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              Text(
                                payMoney(others[i].finalAmount),
                                style: AppText.tabular(size: 13),
                              ),
                              const SizedBox(width: 8),
                              payStatusTag(others[i].status),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }

  Widget _manage(MemberPayment p) {
    return TeamSectionCard(
      icon: Icons.tune_rounded,
      color: TeamColors.amber,
      title: 'Manage',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TeamOutlineButton(
            label: 'Verify gateway status',
            icon: Icons.sync_rounded,
            onTap: _busy ? null : _verify,
          ),
          if (p.canCancel) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onTap: _busy ? null : _cancel,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: AppColors.dangerSoft,
                  border: Border.all(
                    color: AppColors.danger.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.cancel_outlined,
                      size: 17,
                      color: AppColors.danger,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Cancel payment',
                      style: AppText.body(
                        size: 14,
                        weight: FontWeight.w800,
                        color: AppColors.danger,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

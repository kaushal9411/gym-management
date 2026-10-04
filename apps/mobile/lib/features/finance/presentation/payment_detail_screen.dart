import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/member_payment.dart';
import '../../../repositories/payment_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'payments_screen.dart';

/// Design frame "14. Payment detail" — the amount hero with its status
/// pill, the Member/Method/Invoice rows, and the Refund + Cancel actions.
///
/// Two things the frame doesn't show but the API does, so they're here:
/// refunds can be **partial** (`amount` is optional on
/// `POST /payments/:id/refund`, and the response carries a `refunds[]`
/// history), and both actions are conditional — Refund needs a `SUCCESS`
/// payment with something still refundable, Cancel is rejected once a
/// refund exists. Buttons hide rather than fail — Refund additionally needs
/// `finance:payment-refund` and a SUCCESS / PARTIALLY_REFUNDED status.
/// The refund sheet (quick amounts, reason chips, after-status preview) and
/// the refunded/refundable balance card use only fields the detail DTO
/// already returns.
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
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _refund() async {
    final payment = _payment;
    if (payment == null) return;
    final result =
        await showModalBottomSheet<({double? amount, String reason})>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _RefundSheet(payment: payment),
    );
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
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Refund recorded')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final payment = _payment;
    if (payment == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        title: Text('Cancel payment?', style: AppText.display(size: 18)),
        content: Text(
          '${payment.paymentNumber} for ${payment.memberName} will be marked '
          'cancelled. This cannot be undone.',
          style: AppText.body(size: 13, color: AppColors.inkFaint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(
              'Keep',
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              'Cancel payment',
              style: AppText.body(
                size: 13,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await getIt<PaymentRepository>().cancel(payment.id);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Payment cancelled')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  bool get _mayRefund {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff &&
        session.user.hasPermission('finance:payment-refund');
  }

  @override
  Widget build(BuildContext context) {
    final payment = _payment;
    final canRefund = payment != null && payment.canRefund && _mayRefund;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Payment', style: AppText.display(size: 18)),
            if (payment != null)
              Text(payment.paymentNumber, style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: payment == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                children: [
                  if (_error != null) ...[
                    FormAlert(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
                      ),
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: Column(
                      children: [
                        Text(
                          Formatters.currency(payment.finalAmount),
                          style: AppText.display(size: 30),
                        ),
                        const SizedBox(height: 6),
                        AppPill(
                          label: payment.status.replaceAll('_', ' '),
                          tone: paymentStatusTones[payment.status] ??
                              AppPillTone.neutral,
                        ),
                        if (payment.totalRefunded > 0) ...[
                          const SizedBox(height: 8),
                          Text(
                            '${Formatters.currency(payment.totalRefunded)} refunded',
                            style: AppText.body(
                              size: 12,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.surface2,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Column(
                      children: [
                        _Row(
                          label: 'Member',
                          value:
                              '${payment.memberName} · ${payment.memberCode}',
                        ),
                        _Row(label: 'Method', value: payment.method),
                        if (payment.planName != null)
                          _Row(label: 'Plan', value: payment.planName!),
                        _Row(
                          label: 'Branch',
                          value: payment.branchName,
                        ),
                        _Row(
                          label: 'Date',
                          value: '${payment.paymentDate.day}/'
                              '${payment.paymentDate.month}/'
                              '${payment.paymentDate.year}',
                        ),
                        if (payment.recordedByName != null)
                          _Row(
                            label: 'Recorded by',
                            value: payment.recordedByName!,
                          ),
                      ],
                    ),
                  ),
                  if (payment.totalRefunded > 0 || payment.canRefund) ...[
                    const SizedBox(height: 12),
                    _BalanceCard(payment: payment),
                  ],
                  if (payment.refunds.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(AppRadii.card),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Refund history', style: AppText.eyebrow()),
                          const SizedBox(height: 8),
                          ...payment.refunds.map(
                            (refund) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          refund.reason ?? 'No reason given',
                                          style: AppText.body(
                                            size: 12.5,
                                            weight: FontWeight.w600,
                                          ),
                                        ),
                                        Text(
                                          Formatters.relativeTime(
                                            refund.refundedAt,
                                          ),
                                          style: AppText.body(
                                            size: 11,
                                            color: AppColors.inkFaint,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    Formatters.currency(refund.amount),
                                    style: AppText.tabular(
                                      size: 13,
                                      weight: FontWeight.w700,
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
                  const SizedBox(height: 20),
                  if (canRefund || payment.canCancel)
                    Row(
                      children: [
                        if (canRefund)
                          Expanded(
                            child: AppButton(
                              label: 'Refund',
                              variant: AppButtonVariant.ghost,
                              loading: _busy,
                              onPressed: _refund,
                            ),
                          ),
                        if (canRefund && payment.canCancel)
                          const SizedBox(width: 10),
                        if (payment.canCancel)
                          Expanded(
                            child: AppButton(
                              label: 'Cancel',
                              variant: AppButtonVariant.ghost,
                              foregroundColor: AppColors.danger,
                              onPressed: _busy ? null : _cancel,
                            ),
                          ),
                      ],
                    ),
                ],
              ),
      ),
    );
  }
}

/// Cap on the free-text refund reason (`refundPaymentSchema.reason`).
const _maxReason = 1000;

const _reasonChips = [
  'Customer request',
  'Duplicate payment',
  'Service not delivered',
  'Billing error',
  'Other',
];

/// Refunded vs still-refundable summary shown under the detail rows.
class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.payment});

  final MemberPayment payment;

  @override
  Widget build(BuildContext context) {
    Widget cell(String label, double v, Color color) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppText.eyebrow()),
              const SizedBox(height: 4),
              Text(
                Formatters.currency(v),
                style: AppText.display(size: 18, color: color),
              ),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          cell('Refunded', payment.totalRefunded, AppColors.warning),
          cell(
            'Refundable',
            payment.status == 'SUCCESS' ||
                    payment.status == 'PARTIALLY_REFUNDED'
                ? payment.refundableAmount
                : 0,
            AppColors.ink,
          ),
        ],
      ),
    );
  }
}

/// Refund bottom sheet: quick-amount chips (25% / 50% / Full remainder /
/// Custom), reason chips + optional note, remaining-balance line and the
/// status the payment will have afterwards. Pops `(amount, reason)`;
/// `amount: null` = full remainder (the API's default).
class _RefundSheet extends StatefulWidget {
  const _RefundSheet({required this.payment});

  final MemberPayment payment;

  @override
  State<_RefundSheet> createState() => _RefundSheetState();
}

class _RefundSheetState extends State<_RefundSheet> {
  final _custom = TextEditingController();
  final _note = TextEditingController();
  String _mode = 'full'; // 25 | 50 | full | custom
  String? _reason;
  String? _error;

  double get _refundable => widget.payment.refundableAmount;

  @override
  void dispose() {
    _custom.dispose();
    _note.dispose();
    super.dispose();
  }

  /// Rounded to cents so 25%/50% never exceed the balance by a float hair.
  double? get _amount {
    switch (_mode) {
      case '25':
        return (_refundable * 25).roundToDouble() / 100;
      case '50':
        return (_refundable * 50).roundToDouble() / 100;
      case 'custom':
        return double.tryParse(_custom.text.trim());
      default:
        return _refundable;
    }
  }

  void _pick(String mode) => setState(() {
        _mode = mode;
        _error = null;
      });

  String? get _invalid {
    final a = _amount;
    if (a == null || a <= 0) return 'Enter a valid amount';
    if (a > _refundable + 0.004) {
      return 'Max ${Formatters.currency(_refundable)} can be refunded';
    }
    return null;
  }

  String get _composedReason {
    final note = _note.text.trim();
    final text =
        [if (_reason != null) _reason!, if (note.isNotEmpty) note].join(' — ');
    return text.length > _maxReason ? text.substring(0, _maxReason) : text;
  }

  void _submit() {
    final problem = _invalid;
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    Navigator.of(context).pop(
      (
        amount: _mode == 'full' ? null : _amount,
        reason: _composedReason,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final amount = _amount;
    final valid = _invalid == null;
    final remaining = valid ? _refundable - amount! : _refundable;
    final after = valid
        ? widget.payment.statusAfterRefund(_mode == 'full' ? null : amount)
        : null;

    Widget chip(String label, bool selected, VoidCallback onTap) => ChoiceChip(
          label: Text(label),
          selected: selected,
          showCheckmark: false,
          onSelected: (_) => onTap(),
          backgroundColor: AppColors.surface3,
          selectedColor: AppColors.staffSoft,
          side: BorderSide(
            color: selected ? AppColors.staffB : AppColors.line,
          ),
          labelStyle: AppText.body(
            size: 12,
            weight: FontWeight.w700,
            color: selected ? AppColors.staffPillFg : AppColors.inkSoft,
          ),
        );

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        18,
        18,
        18,
        18 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Refund payment', style: AppText.display(size: 18)),
          const SizedBox(height: 4),
          Text(
            '${widget.payment.paymentNumber} · up to '
            '${Formatters.currency(_refundable)} refundable',
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 14),
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 10),
          ],
          Text('Amount', style: AppText.eyebrow()),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              chip('25%', _mode == '25', () => _pick('25')),
              chip('50%', _mode == '50', () => _pick('50')),
              chip('Full remainder', _mode == 'full', () => _pick('full')),
              chip('Custom', _mode == 'custom', () => _pick('custom')),
            ],
          ),
          if (_mode == 'custom') ...[
            const SizedBox(height: 10),
            TextField(
              controller: _custom,
              autofocus: true,
              onChanged: (_) => setState(() => _error = null),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              style: AppText.body(size: 15, weight: FontWeight.w600),
              decoration: _fieldDecoration('Amount'),
            ),
          ],
          const SizedBox(height: 14),
          Text('Reason', style: AppText.eyebrow()),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final r in _reasonChips)
                chip(
                  r,
                  _reason == r,
                  () => setState(() => _reason = _reason == r ? null : r),
                ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _note,
            maxLength: _maxReason,
            maxLines: 2,
            style: AppText.body(size: 15, weight: FontWeight.w600),
            decoration: _fieldDecoration('Note (optional)'),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface3,
              borderRadius: BorderRadius.circular(AppRadii.field),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Refunding ${valid ? Formatters.currency(amount!) : '—'} · '
                  '${Formatters.currency(remaining)} would remain',
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
                if (after != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'After this refund: ${after.replaceAll('_', ' ')}',
                    style: AppText.body(
                      size: 12,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Cancel',
                  variant: AppButtonVariant.ghost,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  label: 'Refund',
                  onPressed: valid ? _submit : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  InputDecoration _fieldDecoration(String hint) => InputDecoration(
        isDense: true,
        filled: true,
        fillColor: AppColors.surface3,
        hintText: hint,
        hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
        counterText: '',
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: const BorderSide(color: AppColors.line),
        ),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

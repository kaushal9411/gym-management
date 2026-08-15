import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
/// refund exists. Buttons hide rather than fail.
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
    final result = await showDialog<({double? amount, String reason})>(
      context: context,
      builder: (_) => _RefundDialog(refundable: payment.refundableAmount),
    );
    if (result == null || !mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final updated = await getIt<PaymentRepository>().refund(
        payment.id,
        amount: result.amount,
        reason: result.reason,
      );
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

  @override
  Widget build(BuildContext context) {
    final payment = _payment;

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
                  if (payment.canRefund || payment.canCancel)
                    Row(
                      children: [
                        if (payment.canRefund)
                          Expanded(
                            child: AppButton(
                              label: 'Refund',
                              variant: AppButtonVariant.ghost,
                              loading: _busy,
                              onPressed: _refund,
                            ),
                          ),
                        if (payment.canRefund && payment.canCancel)
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

/// Refund amount defaults to everything still refundable; clearing it back
/// to empty sends no `amount`, which the API treats as a full refund.
class _RefundDialog extends StatefulWidget {
  const _RefundDialog({required this.refundable});

  final double refundable;

  @override
  State<_RefundDialog> createState() => _RefundDialogState();
}

class _RefundDialogState extends State<_RefundDialog> {
  late final _amountController = TextEditingController(
    text: widget.refundable.toStringAsFixed(
      widget.refundable % 1 == 0 ? 0 : 2,
    ),
  );
  final _reasonController = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _amountController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _submit() {
    final raw = _amountController.text.trim();
    final amount = raw.isEmpty ? null : double.tryParse(raw);
    if (raw.isNotEmpty && (amount == null || amount <= 0)) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    if (amount != null && amount > widget.refundable) {
      setState(
        () => _error =
            'Max ${Formatters.currency(widget.refundable)} can be refunded',
      );
      return;
    }
    Navigator.of(context).pop(
      (amount: amount, reason: _reasonController.text.trim()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      title: Text('Refund payment', style: AppText.display(size: 18)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 10),
          ],
          Text(
            'Up to ${Formatters.currency(widget.refundable)} refundable.',
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
            style: AppText.body(size: 15, weight: FontWeight.w600),
            decoration: _fieldDecoration('Amount'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _reasonController,
            style: AppText.body(size: 15, weight: FontWeight.w600),
            decoration: _fieldDecoration('Reason (optional)'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            'Cancel',
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
        ),
        TextButton(
          onPressed: _submit,
          child: Text(
            'Refund',
            style: AppText.body(
              size: 13,
              weight: FontWeight.w700,
              color: AppColors.staffPillFg,
            ),
          ),
        ),
      ],
    );
  }

  InputDecoration _fieldDecoration(String hint) => InputDecoration(
        isDense: true,
        filled: true,
        fillColor: AppColors.surface3,
        hintText: hint,
        hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
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

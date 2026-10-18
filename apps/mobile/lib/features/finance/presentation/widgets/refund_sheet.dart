import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_currency.dart';
import '../../../../models/member_payment.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../payments_ui.dart';

/// Cap on the free-text refund reason (`refundPaymentSchema.reason`).
const kMaxRefundReason = 1000;

/// Web's refund-dialog reason chips (`REASONS`).
const kRefundReasons = [
  'Plan downgraded',
  'Duplicate charge',
  'Member left',
  'Service issue',
  'Other',
];

/// What the sheet hands back: [amount] null = "refund the full remainder"
/// (the API's default — the same call the old sheet made).
typedef RefundChoice = ({double? amount, String reason});

/// Web's `RefundDialog` as a bottom sheet: Paid / Already refunded /
/// Refundable stats, 25% / 50% / Full remainder / Custom amount chips, reason
/// chips + note, a past / this / left bar and the status the payment will have
/// afterwards. Returns the choice, or null when dismissed.
Future<RefundChoice?> showRefundSheet(
  BuildContext context,
  MemberPayment payment,
) {
  return showTeamSheet<RefundChoice>(
    context,
    (_) => RefundSheet(payment: payment),
  );
}

class RefundSheet extends StatefulWidget {
  const RefundSheet({super.key, required this.payment});

  final MemberPayment payment;

  @override
  State<RefundSheet> createState() => _RefundSheetState();
}

class _RefundSheetState extends State<RefundSheet> {
  late final TextEditingController _amount;
  final _note = TextEditingController();
  String _mode = 'full'; // 25 | 50 | full | custom
  String? _reason;

  double get _paid => widget.payment.finalAmount;
  double get _already => widget.payment.totalRefunded;
  double get _refundable => widget.payment.refundableAmount;

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(text: _refundable.toStringAsFixed(2));
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  /// Rounded to cents so 25%/50% never exceed the balance by a float hair.
  void _pick(String mode) {
    setState(() {
      _mode = mode;
      switch (mode) {
        case '25':
          _amount.text =
              ((_refundable * 25).roundToDouble() / 100).toStringAsFixed(2);
        case '50':
          _amount.text =
              ((_refundable * 50).roundToDouble() / 100).toStringAsFixed(2);
        case 'full':
          _amount.text = _refundable.toStringAsFixed(2);
        default:
          _amount.clear();
      }
    });
  }

  double? get _value => double.tryParse(_amount.text.trim());

  bool get _valid {
    final v = _value;
    return v != null && v > 0 && v <= _refundable + 0.004;
  }

  String get _composedReason {
    final note = _note.text.trim();
    // Web: the "Other" chip adds nothing of its own, only the note.
    final chip = (_reason != null && _reason != 'Other') ? _reason! : null;
    final text =
        chip != null ? (note.isNotEmpty ? '$chip — $note' : chip) : note;
    return text.length > kMaxRefundReason
        ? text.substring(0, kMaxRefundReason)
        : text;
  }

  void _submit() {
    if (!_valid) return;
    final RefundChoice choice = (
      amount: _mode == 'full' ? null : _value,
      reason: _composedReason,
    );
    Navigator.of(context).pop(choice);
  }

  double _pct(double v) =>
      _paid > 0 ? (v / _paid * 100).clamp(0, 100).toDouble() : 0;

  @override
  Widget build(BuildContext context) {
    final valid = _valid;
    final value = valid ? _value! : 0.0;
    final left = (_refundable - value).clamp(0, double.infinity).toDouble();
    final after = valid
        ? widget.payment.statusAfterRefund(_mode == 'full' ? null : value)
        : null;
    final p = widget.payment;

    return TeamSheetScaffold(
      icon: Icons.undo_rounded,
      title: 'Refund payment',
      subtitle: '${p.paymentNumber} · ${p.memberName}',
      color: TeamColors.rose,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _Stat(label: 'Paid', value: payMoney(_paid)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Stat(
                  label: 'Already refunded',
                  value: payMoney(_already),
                  color: TeamColors.rose,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Stat(
                  label: 'Refundable now',
                  value: payMoney(_refundable),
                  color: TeamColors.green,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text('REFUND AMOUNT', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TeamFilterChip(
                label: '25%',
                selected: _mode == '25',
                onTap: () => _pick('25'),
              ),
              TeamFilterChip(
                label: '50%',
                selected: _mode == '50',
                onTap: () => _pick('50'),
              ),
              TeamFilterChip(
                label: 'Full remainder',
                selected: _mode == 'full',
                onTap: () => _pick('full'),
              ),
              TeamFilterChip(
                label: 'Custom',
                selected: _mode == 'custom',
                onTap: () => _pick('custom'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.field),
              border: Border.all(
                color: valid || _amount.text.isEmpty
                    ? AppColors.line
                    : AppColors.danger,
                width: 1.4,
              ),
            ),
            child: Row(
              children: [
                Text(
                  AppCurrency.symbol,
                  style: AppText.display(size: 20, color: AppColors.inkFaint),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _amount,
                    onChanged: (_) => setState(() => _mode = 'custom'),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                        RegExp(r'^\d*\.?\d{0,2}'),
                      ),
                    ],
                    style: AppText.display(size: 22),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 14),
                      hintText: '0.00',
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (!valid && _amount.text.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Enter an amount between 0 and ${payMoney(_refundable)}.',
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: AppColors.danger,
                ),
              ),
            ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 8,
              child: Row(
                children: [
                  for (final seg in [
                    (_pct(_already), TeamColors.fuchsia),
                    (_pct(value), TeamColors.indigo),
                    (
                      (100 - _pct(_already) - _pct(value)).clamp(0, 100),
                      AppColors.surface3,
                    ),
                  ])
                    if ((seg.$1 * 10).round() > 0)
                      Expanded(
                        flex: (seg.$1 * 10).round(),
                        child: Container(color: seg.$2),
                      ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _barLabel('Past ${_pct(_already).toStringAsFixed(0)}%'),
              _barLabel('This ${_pct(value).toStringAsFixed(1)}%'),
              _barLabel('Left ${_pct(left).toStringAsFixed(1)}%'),
            ],
          ),
          const SizedBox(height: 16),
          Text('REASON', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final r in kRefundReasons)
                TeamFilterChip(
                  label: r,
                  selected: _reason == r,
                  onTap: () =>
                      setState(() => _reason = _reason == r ? null : r),
                ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _note,
            maxLength: kMaxRefundReason,
            maxLines: 2,
            style: AppText.body(size: 15, weight: FontWeight.w600),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: AppColors.surface2,
              hintText: 'Add a note for the audit log (optional)…',
              hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
              counterText: '',
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.field),
                borderSide: BorderSide(color: AppColors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.field),
                borderSide: BorderSide(color: AppColors.line),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: TeamColors.indigo.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Refunding ${valid ? payMoney(value) : '—'} · '
                  '${payMoney(valid ? left : _refundable)} would remain',
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: TeamColors.indigo,
                  ),
                ),
                if (after != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    'After this refund: ${after.replaceAll('_', ' ')}',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: AppColors.inkSoft,
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
                child: TeamOutlineButton(
                  label: 'Cancel',
                  onTap: () => Navigator.of(context).pop(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: TeamGradientButton(
                  label: valid ? 'Refund ${payMoney(value)}' : 'Refund',
                  icon: Icons.undo_rounded,
                  gradient: const LinearGradient(
                    colors: [TeamColors.rose, Color(0xFFE11D48)],
                  ),
                  onTap: valid ? _submit : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _barLabel(String t) => Text(
        t,
        style: AppText.body(
          size: 10.5,
          color: AppColors.inkFaint,
          weight: FontWeight.w700,
        ),
      );
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.ink;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color:
            color == null ? AppColors.surface3 : color!.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(
              size: 9,
              weight: FontWeight.w800,
              color: AppColors.inkFaint,
            ).copyWith(letterSpacing: 0.5),
          ),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: AppText.display(size: 16, color: c)),
          ),
        ],
      ),
    );
  }
}

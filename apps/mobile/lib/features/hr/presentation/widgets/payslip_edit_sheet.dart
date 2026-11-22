import 'package:flutter/material.dart';

import '../../../../bloc/hr/hr_forms.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/hr_payroll.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_form_kit.dart';

/// Editor of one DRAFT payslip: bonus, advance recovery and extra allowance /
/// deduction lines (`PATCH /hr/payroll/payslips/:id`). The sheet only
/// validates and returns the [HrPayslipEdit]; the caller (the payroll run
/// cubit) sends it, and the server recomputes the totals - so what the user
/// sees afterwards is always the API's number.
///
/// Returns `null` when dismissed.
Future<HrPayslipEdit?> showPayslipEditSheet(
  BuildContext context, {
  required HrPayslip payslip,
}) {
  return showTeamSheet<HrPayslipEdit>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.edit_note_rounded,
      color: HrPalette.money,
      title: 'Edit payslip',
      subtitle: '${payslip.summary.employee?.name ?? 'Employee'} · '
          '${Formatters.currency(payslip.netPay)} net now',
      child: PayslipEditForm(payslip: payslip),
    ),
  );
}

class _Row {
  _Row({String name = '', String amount = '', this.allowance = true})
      : name = TextEditingController(text: name),
        amount = TextEditingController(text: amount);

  final TextEditingController name;
  final TextEditingController amount;
  bool allowance;

  void dispose() {
    name.dispose();
    amount.dispose();
  }
}

class PayslipEditForm extends StatefulWidget {
  const PayslipEditForm({super.key, required this.payslip});

  final HrPayslip payslip;

  @override
  State<PayslipEditForm> createState() => _PayslipEditFormState();
}

class _PayslipEditFormState extends State<PayslipEditForm> {
  late final _bonus = TextEditingController(
    text: widget.payslip.bonus > 0 ? _num(widget.payslip.bonus) : '',
  );
  late final _advance = TextEditingController(
    text: widget.payslip.advanceRecovery > 0
        ? _num(widget.payslip.advanceRecovery)
        : '',
  );
  final _remark = TextEditingController();
  late final List<_Row> _rows = [
    for (final l in widget.payslip.manualLines)
      _Row(name: l.name, amount: _num(l.amount), allowance: l.isAllowance),
  ];
  Map<String, String> _errors = {};

  static String _num(double v) =>
      v == v.roundToDouble() ? v.round().toString() : v.toString();

  @override
  void dispose() {
    _bonus.dispose();
    _advance.dispose();
    _remark.dispose();
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  void _submit() {
    final errors = validatePayslipEdit(
      bonusText: _bonus.text,
      advanceText: _advance.text,
      lines: [
        for (final r in _rows)
          HrLineDraft(name: r.name.text, amountText: r.amount.text),
      ],
    );
    setState(() => _errors = errors);
    if (errors.isNotEmpty) return;
    Navigator.of(context).pop(
      HrPayslipEdit(
        bonus: hrParseNumber(_bonus.text) ?? 0,
        advanceRecovery: hrParseNumber(_advance.text) ?? 0,
        manualLines: [
          for (final r in _rows)
            HrManualLine(
              name: r.name.text,
              isAllowance: r.allowance,
              amount: hrParseNumber(r.amount.text)!,
            ),
        ],
        remark: _remark.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: AppLabeledField(
                key: const Key('payslip-bonus'),
                label: 'Bonus (₹)',
                controller: _bonus,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                errorText: _errors['bonus'],
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AppLabeledField(
                key: const Key('payslip-advance'),
                label: 'Advance recovery (₹)',
                controller: _advance,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                errorText: _errors['advanceRecovery'],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const HrFieldLabel('EXTRA ALLOWANCES / DEDUCTIONS'),
        for (var i = 0; i < _rows.length; i++) ...[
          _LineEditor(
            key: ObjectKey(_rows[i]),
            index: i,
            row: _rows[i],
            error: _errors['line$i'],
            onChanged: () => setState(() {}),
            onRemove: () => setState(() => _rows.removeAt(i).dispose()),
          ),
          const SizedBox(height: 10),
        ],
        HrAddButton(
          key: const Key('payslip-add-line'),
          label: 'Add line',
          onTap: _rows.length >= 20
              ? null
              : () => setState(() => _rows.add(_Row())),
        ),
        if (_errors['lines'] != null)
          Text(
            _errors['lines']!,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: AppColors.danger,
            ),
          ),
        const SizedBox(height: 8),
        AppLabeledField(
          key: const Key('payslip-remark'),
          label: 'Note (optional)',
          controller: _remark,
        ),
        const SizedBox(height: 6),
        Text(
          'The server recalculates the payslip when you save.',
          style: AppText.body(
            size: 11.5,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('payslip-save'),
          label: 'Save and recalculate',
          icon: Icons.calculate_rounded,
          gradient: const LinearGradient(
            colors: [HrPalette.paid, HrPalette.money],
          ),
          onTap: _submit,
        ),
      ],
    );
  }
}

class _LineEditor extends StatelessWidget {
  const _LineEditor({
    super.key,
    required this.index,
    required this.row,
    required this.error,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final _Row row;
  final String? error;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final color = hrMoneyColor(row.allowance);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color:
              error != null ? AppColors.danger : color.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: Key('line-name-$index'),
                  controller: row.name,
                  maxLength: 60,
                  onChanged: (_) => onChanged(),
                  style: AppText.body(),
                  decoration: hrFieldDecoration('e.g. Incentive', focus: color)
                      .copyWith(counterText: ''),
                ),
              ),
              IconButton(
                key: Key('line-remove-$index'),
                tooltip: 'Remove line',
                onPressed: onRemove,
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  size: 20,
                  color: AppColors.danger,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  children: [
                    TeamFilterChip(
                      key: Key('line-type-allowance-$index'),
                      label: 'Allowance +',
                      selected: row.allowance,
                      color: HrPalette.paid,
                      onTap: () {
                        row.allowance = true;
                        onChanged();
                      },
                    ),
                    TeamFilterChip(
                      key: Key('line-type-deduction-$index'),
                      label: 'Deduction −',
                      selected: !row.allowance,
                      color: HrPalette.absent,
                      onTap: () {
                        row.allowance = false;
                        onChanged();
                      },
                    ),
                  ],
                ),
              ),
              SizedBox(
                width: 110,
                child: TextField(
                  key: Key('line-amount-$index'),
                  controller: row.amount,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => onChanged(),
                  style: AppText.body(),
                  decoration: hrFieldDecoration('Amount', focus: color),
                ),
              ),
            ],
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                error!,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: AppColors.danger,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

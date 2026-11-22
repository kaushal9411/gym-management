import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../bloc/hr/hr_forms.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/hr_admin.dart';
import '../../../../models/hr_leave.dart';
import '../../../../models/hr_payroll.dart';
import '../../../../models/hr_setup.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_calendar_card.dart';
import 'hr_form_kit.dart';
import 'hr_ui.dart';
import 'hr_widgets.dart';

// ── shift + weekly off (hr:settings_manage) ─────────────────────────────────

/// Assign a shift and weekly-off days to one employee
/// (`PUT /hr/employees/:id/work-setup`, `hr:settings_manage`). "Gym default
/// shift" sends `shiftId: null`; "Inherit weekly off" sends `weeklyOff: null`
/// (the shift's / policy's days apply). Returns `true` when saved.
Future<bool> showWorkSetupSheet(
  BuildContext context, {
  required HrEmployee employee,
}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.schedule_rounded,
      color: HrPalette.run,
      title: 'Shift & weekly off',
      subtitle: '${employee.name} · drives late marks, leave days and payroll',
      child: _WorkSetupForm(employee: employee),
    ),
  );
  return changed == true;
}

class _WorkSetupForm extends StatefulWidget {
  const _WorkSetupForm({required this.employee});

  final HrEmployee employee;

  @override
  State<_WorkSetupForm> createState() => _WorkSetupFormState();
}

class _WorkSetupFormState extends State<_WorkSetupForm> {
  List<HrShift>? _shifts;
  String? _loadError;
  late String? _shiftId = widget.employee.shift?.id;
  late List<String> _off = widget.employee.weeklyOff;
  bool _inherit = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final s = await getIt<HrRepository>().shifts();
      if (mounted) {
        setState(() => _shifts = s.where((x) => x.isActive).toList());
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    }
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await getIt<HrRepository>().setWorkSetup(
        widget.employee.userId,
        shiftId: _shiftId,
        weeklyOff: _inherit ? null : _off,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(context, 'Work setup updated');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.detailedMessage;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadError != null) {
      return AppErrorView(message: _loadError!, onRetry: _load);
    }
    final shifts = _shifts;
    if (shifts == null) return const HrSkeletonList(count: 3, height: 54);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const HrFieldLabel('SHIFT'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            TeamFilterChip(
              key: const Key('shift-default'),
              label: 'Gym default shift',
              selected: _shiftId == null,
              color: HrPalette.run,
              onTap: () => setState(() => _shiftId = null),
            ),
            for (final s in shifts)
              TeamFilterChip(
                key: Key('shift-${s.id}'),
                label:
                    '${s.name} (${hrTime12(s.startTime)}–${hrTime12(s.endTime)})',
                selected: _shiftId == s.id,
                color: HrPalette.run,
                onTap: () => setState(() => _shiftId = s.id),
              ),
          ],
        ),
        const SizedBox(height: 16),
        const HrFieldLabel('WEEKLY OFF DAYS'),
        HrWeekdayChips(
          selected: _off,
          enabled: !_inherit,
          onChanged: (v) => setState(() => _off = v),
        ),
        const SizedBox(height: 12),
        TeamToggleRow(
          key: const Key('inherit-off'),
          title: 'Inherit weekly off',
          subtitle: 'Use the shift / gym policy days instead',
          value: _inherit,
          color: HrPalette.run,
          onChanged: (v) => setState(() => _inherit = v),
        ),
        HrFormMessage(_error),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('work-setup-save'),
          label: 'Save work setup',
          icon: Icons.check_rounded,
          loading: _busy,
          onTap: _busy ? null : _save,
        ),
      ],
    );
  }
}

// ── pay structure (hr:payroll_manage) ───────────────────────────────────────

/// Edit one employee's pay structure: base salary plus allowance / deduction
/// components (`PUT /hr/employees/:id/pay-structure`, `hr:payroll_manage`).
/// The component list replaces the whole set (max 20) and applies to the NEXT
/// payroll generation / recalculation. The gross / fixed-deduction / net
/// preview counts up as the numbers change. Returns `true` when saved.
Future<bool> showPayStructureSheet(
  BuildContext context, {
  required String userId,
  required String name,
  HrPayStructure? current,
}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.account_balance_wallet_rounded,
      color: HrPalette.money,
      title: 'Pay structure',
      subtitle: '$name · applies to the next payroll run',
      child: _PayStructureForm(userId: userId, current: current),
    ),
  );
  return changed == true;
}

class _CompRow {
  _CompRow({
    String name = '',
    String amount = '',
    this.allowance = true,
    this.active = true,
  })  : name = TextEditingController(text: name),
        amount = TextEditingController(text: amount);

  final TextEditingController name;
  final TextEditingController amount;
  bool allowance;
  bool active;

  void dispose() {
    name.dispose();
    amount.dispose();
  }
}

class _PayStructureForm extends StatefulWidget {
  const _PayStructureForm({required this.userId, this.current});

  final String userId;
  final HrPayStructure? current;

  @override
  State<_PayStructureForm> createState() => _PayStructureFormState();
}

class _PayStructureFormState extends State<_PayStructureForm> {
  late final _base = TextEditingController(
    text: widget.current?.baseSalary == null
        ? ''
        : _n(widget.current!.baseSalary!),
  );
  late final List<_CompRow> _rows = [
    for (final c in widget.current?.components ?? const <HrPayComponent>[])
      _CompRow(
        name: c.name,
        amount: _n(c.amount),
        allowance: c.isAllowance,
        active: c.isActive,
      ),
  ];
  Map<String, String> _errors = {};
  String? _serverError;
  bool _busy = false;

  static String _n(double v) =>
      v == v.roundToDouble() ? v.round().toString() : v.toString();

  @override
  void dispose() {
    _base.dispose();
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  double _num(String v) => hrParseNumber(v) ?? 0;

  double get _gross =>
      _num(_base.text) +
      _rows
          .where((r) => r.allowance && r.active)
          .fold<double>(0, (s, r) => s + _num(r.amount.text));

  double get _fixedDed => _rows
      .where((r) => !r.allowance && r.active)
      .fold<double>(0, (s, r) => s + _num(r.amount.text));

  Future<void> _save() async {
    final errors = validatePayStructure(
      baseText: _base.text,
      rows: [
        for (final r in _rows)
          HrLineDraft(name: r.name.text, amountText: r.amount.text),
      ],
    );
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) return;
    setState(() => _busy = true);
    try {
      await getIt<HrRepository>().savePayStructure(
        widget.userId,
        baseSalary: _base.text.trim().isEmpty ? null : _num(_base.text),
        components: [
          for (final r in _rows)
            HrPayComponent(
              name: r.name.text,
              isAllowance: r.allowance,
              amount: _num(r.amount.text),
              isActive: r.active,
            ),
        ],
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(context, 'Pay structure saved. It applies to the next payroll.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _serverError = e.detailedMessage;
        final fe = hrServerFieldErrors(e);
        if (fe['baseSalary'] != null) {
          _errors = {'baseSalary': fe['baseSalary']!};
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.current != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              '${widget.current!.salaryType[0]}'
              '${widget.current!.salaryType.substring(1).toLowerCase()} '
              'salary',
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ),
        AppLabeledField(
          key: const Key('ps-base'),
          label: 'Base salary (₹)',
          controller: _base,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          errorText: _errors['baseSalary'],
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        const HrFieldLabel('COMPONENTS'),
        if (_rows.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'No allowances or fixed deductions.',
              style: AppText.body(size: 13, color: AppColors.inkFaint),
            ),
          ),
        for (var i = 0; i < _rows.length; i++) ...[
          _CompEditor(
            key: ObjectKey(_rows[i]),
            index: i,
            row: _rows[i],
            error: _errors['row$i'],
            onChanged: () => setState(() {}),
            onRemove: () => setState(() => _rows.removeAt(i).dispose()),
          ),
          const SizedBox(height: 10),
        ],
        HrAddButton(
          key: const Key('ps-add'),
          label: 'Add component',
          color: HrPalette.money,
          onTap: _rows.length >= 20
              ? null
              : () => setState(() => _rows.add(_CompRow())),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _Preview(label: 'Monthly gross', value: _gross),
            const SizedBox(width: 8),
            _Preview(
              label: 'Fixed deductions',
              value: _fixedDed,
              color: HrPalette.absent,
            ),
            const SizedBox(width: 8),
            _Preview(
              label: 'Net (pre-attendance)',
              value: (_gross - _fixedDed).clamp(0, double.infinity),
              color: HrPalette.paid,
            ),
          ],
        ),
        HrFormMessage(_serverError),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('ps-save'),
          label: 'Save pay structure',
          icon: Icons.check_rounded,
          loading: _busy,
          gradient: const LinearGradient(
            colors: [HrPalette.paid, HrPalette.money],
          ),
          onTap: _busy ? null : _save,
        ),
      ],
    );
  }
}

class _Preview extends StatelessWidget {
  const _Preview({
    required this.label,
    required this.value,
    this.color = HrPalette.money,
  });

  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          child: Column(
            children: [
              Text(
                label,
                textAlign: TextAlign.center,
                style: AppText.body(
                  size: 9.5,
                  weight: FontWeight.w800,
                  color: AppColors.inkFaint,
                ),
              ),
              const SizedBox(height: 2),
              HrMoneyCount(
                value: value,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w900,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      );
}

class _CompEditor extends StatelessWidget {
  const _CompEditor({
    super.key,
    required this.index,
    required this.row,
    required this.error,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final _CompRow row;
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
                  key: Key('comp-name-$index'),
                  controller: row.name,
                  maxLength: 60,
                  onChanged: (_) => onChanged(),
                  style: AppText.body(),
                  decoration:
                      hrFieldDecoration('e.g. Travel allowance', focus: color)
                          .copyWith(counterText: ''),
                ),
              ),
              IconButton(
                key: Key('comp-remove-$index'),
                tooltip: 'Remove component',
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
                  runSpacing: 6,
                  children: [
                    TeamFilterChip(
                      key: Key('comp-allowance-$index'),
                      label: 'Allowance +',
                      selected: row.allowance,
                      color: HrPalette.paid,
                      onTap: () {
                        row.allowance = true;
                        onChanged();
                      },
                    ),
                    TeamFilterChip(
                      key: Key('comp-deduction-$index'),
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
                width: 100,
                child: TextField(
                  key: Key('comp-amount-$index'),
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
          const SizedBox(height: 8),
          TeamToggleRow(
            title: 'Active',
            subtitle: row.active ? 'Counted in payroll' : 'Switched off',
            value: row.active,
            color: color,
            onChanged: (v) {
              row.active = v;
              onChanged();
            },
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

// ── leave balance adjust (hr:leave_manage) ──────────────────────────────────

/// Credit / debit one leave balance (`POST /hr/leave-balances/adjust`,
/// `hr:leave_manage`). Only quota types are offered (an unlimited type answers
/// 409); the **remark is required** (>= 3 characters) and the API's 422 (an
/// adjustment cannot push entitlement below used + pending) is shown under the
/// form. Returns `true` when applied.
Future<bool> showBalanceAdjustSheet(
  BuildContext context, {
  required String userId,
  required String name,
  required List<HrLeaveBalance> balances,
}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.tune_rounded,
      color: HrPalette.onLeave,
      title: 'Adjust leave balance',
      subtitle: name,
      child: _AdjustForm(userId: userId, balances: balances),
    ),
  );
  return changed == true;
}

class _AdjustForm extends StatefulWidget {
  const _AdjustForm({required this.userId, required this.balances});

  final String userId;
  final List<HrLeaveBalance> balances;

  @override
  State<_AdjustForm> createState() => _AdjustFormState();
}

class _AdjustFormState extends State<_AdjustForm> {
  late final List<HrLeaveBalance> _quota =
      widget.balances.where((b) => !b.unlimited).toList();
  late String? _typeId = _quota.isEmpty ? null : _quota.first.leaveType.id;
  bool _credit = true;
  final _days = TextEditingController(text: '1');
  final _remark = TextEditingController();
  Map<String, String> _errors = {};
  String? _serverError;
  bool _busy = false;

  @override
  void dispose() {
    _days.dispose();
    _remark.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final errors = validateBalanceAdjust(
      leaveTypeId: _typeId,
      daysText: _days.text,
      remark: _remark.text,
    );
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) return;
    final n = hrParseNumber(_days.text)!;
    setState(() => _busy = true);
    try {
      await getIt<HrRepository>().adjustLeaveBalance(
        userId: widget.userId,
        leaveTypeId: _typeId!,
        days: _credit ? n : -n,
        remark: _remark.text,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(
        context,
        '${_credit ? 'Credited' : 'Debited'} ${hrDays(n)} '
        'day${n == 1 ? '' : 's'}',
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        final fe = hrServerFieldErrors(e);
        _errors = {if (fe['remark'] != null) 'remark': fe['remark']!};
        _serverError = e.detailedMessage;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_quota.isEmpty) {
      return Text(
        'Every leave type here is unlimited, so there is no balance to '
        'adjust.',
        style: AppText.body(color: AppColors.inkSoft),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const HrFieldLabel('LEAVE TYPE'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final b in _quota)
              TeamFilterChip(
                key: Key('adjust-type-${b.leaveType.id}'),
                label: b.leaveType.name,
                selected: _typeId == b.leaveType.id,
                color: HrPalette.leaveType(b.leaveType.colorHex),
                onTap: () => setState(() => _typeId = b.leaveType.id),
              ),
          ],
        ),
        const SizedBox(height: 14),
        const HrFieldLabel('ACTION'),
        Row(
          children: [
            Expanded(
              child: TeamFilterChip(
                key: const Key('adjust-credit'),
                label: '+ Credit',
                selected: _credit,
                color: HrPalette.paid,
                onTap: () => setState(() => _credit = true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TeamFilterChip(
                key: const Key('adjust-debit'),
                label: '− Debit',
                selected: !_credit,
                color: HrPalette.absent,
                onTap: () => setState(() => _credit = false),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        AppLabeledField(
          key: const Key('adjust-days'),
          label: 'Days',
          controller: _days,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          errorText: _errors['days'],
        ),
        const SizedBox(height: 12),
        AppLabeledField(
          key: const Key('adjust-remark'),
          label: 'Remark (required)',
          controller: _remark,
          hintText: 'e.g. Comp-off for working on Diwali',
          errorText: _errors['remark'],
          minLines: 2,
          maxLines: 4,
        ),
        HrFormMessage(_serverError),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('adjust-save'),
          label: 'Apply adjustment',
          icon: Icons.check_rounded,
          loading: _busy,
          onTap: _busy ? null : _save,
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/hr/hr_forms.dart';
import '../../../../bloc/hr/hr_load_cubit.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/hr_setup.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import '../widgets/hr_form_kit.dart';
import '../widgets/hr_ui.dart';
import '../widgets/hr_widgets.dart';
import 'setup_ui.dart';

const _monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// **HR policy** (`GET` / `PUT /hr/policy`, edit with `hr:settings_manage`):
/// the rules that drive attendance status, leave counting and payroll - leave
/// year start month (locked once leave requests exist; the API answers 409),
/// late grace, half-day threshold, standard day, back-date window, default
/// weekly off, the late-penalty and overtime switches with their rates. The
/// working-days basis is a read-only constant, shown as a note (the web does
/// not offer it as an input either).
class PolicyPanel extends StatelessWidget {
  const PolicyPanel({super.key, required this.canEdit});

  final bool canEdit;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HrLoadCubit<HrPolicy>, HrLoadState<HrPolicy>>(
      builder: (context, state) => switch (state) {
        HrLoadLoading() => const HrSkeletonList(count: 3, height: 90),
        HrLoadError(:final message) => AppErrorView(
            message: message,
            onRetry: () => context.read<HrLoadCubit<HrPolicy>>().load(),
          ),
        HrLoadLoaded(:final data) => _PolicyForm(
            // A fresh form whenever the server copy changes.
            key: ValueKey(data.toJson().toString()),
            policy: data,
            canEdit: canEdit,
            onSaved: () =>
                context.read<HrLoadCubit<HrPolicy>>().load(silent: true),
          ),
      },
    );
  }
}

class _PolicyForm extends StatefulWidget {
  const _PolicyForm({
    super.key,
    required this.policy,
    required this.canEdit,
    required this.onSaved,
  });

  final HrPolicy policy;
  final bool canEdit;
  final VoidCallback onSaved;

  @override
  State<_PolicyForm> createState() => _PolicyFormState();
}

class _PolicyFormState extends State<_PolicyForm> {
  late int _month = widget.policy.leaveYearStartMonth;
  late List<String> _off = widget.policy.defaultWeeklyOff;
  late bool _latePenalty = widget.policy.latePenaltyEnabled;
  late bool _overtime = widget.policy.overtimeEnabled;
  late final _grace = _c('${widget.policy.lateGraceMinutes}');
  late final _half = _c(hrDays(widget.policy.halfDayThresholdHours));
  late final _std = _c(hrDays(widget.policy.standardDayHours));
  late final _back = _c('${widget.policy.backdateLeaveDays}');
  late final _lpu = _c('${widget.policy.latePenaltyLatesPerUnit}');
  late final _lpd = _c(hrDays(widget.policy.latePenaltyDays));
  late final _otm = _c(hrDays(widget.policy.overtimeMultiplier));
  Map<String, String> _errors = {};
  String? _serverError;
  bool _busy = false;

  TextEditingController _c(String v) => TextEditingController(text: v);

  @override
  void dispose() {
    for (final c in [_grace, _half, _std, _back, _lpu, _lpd, _otm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickMonth() async {
    final picked = await pickOneSheet(
      context,
      title: 'Leave year starts in',
      options: [
        for (var i = 0; i < 12; i++) ('${i + 1}', _monthNames[i]),
      ],
      current: '$_month',
    );
    if (picked != null && picked.isNotEmpty) {
      setState(() => _month = int.parse(picked));
    }
  }

  Future<void> _save() async {
    final draft = HrPolicyDraft(
      lateGraceMinutes: _grace.text,
      halfDayThresholdHours: _half.text,
      standardDayHours: _std.text,
      latePenaltyLatesPerUnit: _lpu.text,
      latePenaltyDays: _lpd.text,
      overtimeMultiplier: _otm.text,
      backdateLeaveDays: _back.text,
    );
    final errors = validatePolicyForm(draft);
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) return;
    final p = widget.policy;
    final next = HrPolicy(
      leaveYearStartMonth: _month,
      defaultWeeklyOff: _off,
      lateGraceMinutes: hrParseNumber(_grace.text)!.round(),
      halfDayThresholdHours: hrParseNumber(_half.text)!,
      standardDayHours: hrParseNumber(_std.text)!,
      latePenaltyEnabled: _latePenalty,
      latePenaltyLatesPerUnit: hrParseNumber(_lpu.text)!.round(),
      latePenaltyDays: hrParseNumber(_lpd.text)!,
      overtimeEnabled: _overtime,
      overtimeMultiplier: hrParseNumber(_otm.text)!,
      backdateLeaveDays: hrParseNumber(_back.text)!.round(),
      workingDaysBasis: p.workingDaysBasis,
    );
    setState(() => _busy = true);
    try {
      await getIt<HrRepository>().savePolicy(next);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() => _busy = false);
      hrSnack(context, 'HR policy saved');
      widget.onSaved();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _errors = hrServerFieldErrors(e);
        _serverError = e.detailedMessage;
      });
    }
  }

  Widget _num(
    String key,
    String label,
    TextEditingController c, {
    String? hint,
    bool enabled = true,
  }) =>
      AppLabeledField(
        key: Key('policy-$key'),
        label: label,
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        errorText: _errors[key],
        hintText: hint,
        readOnly: !widget.canEdit || !enabled,
      );

  @override
  Widget build(BuildContext context) {
    final edit = widget.canEdit;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const HrSectionHeader(title: 'Leave year & attendance rules'),
        HrCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const HrFieldLabel('LEAVE YEAR STARTS IN'),
              Semantics(
                button: edit,
                label: 'Leave year starts in ${_monthNames[_month - 1]}',
                excludeSemantics: true,
                child: InkWell(
                  key: const Key('policy-month'),
                  borderRadius: BorderRadius.circular(14),
                  onTap: edit ? _pickMonth : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _errors['leaveYearStartMonth'] != null
                            ? AppColors.danger
                            : AppColors.line,
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _monthNames[_month - 1],
                            style: AppText.body(weight: FontWeight.w800),
                          ),
                        ),
                        if (edit)
                          Icon(
                            Icons.unfold_more_rounded,
                            size: 18,
                            color: AppColors.inkFaint,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 4),
                child: Text(
                  _errors['leaveYearStartMonth'] ??
                      'Locked once leave requests exist.',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: _errors['leaveYearStartMonth'] != null
                        ? AppColors.danger
                        : AppColors.inkFaint,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _num(
                'lateGraceMinutes',
                'Late grace (minutes)',
                _grace,
                hint: 'Default for new shifts',
              ),
              const SizedBox(height: 12),
              _num(
                'halfDayThresholdHours',
                'Half-day below (hours)',
                _half,
                hint: 'Worked time under this is a half day',
              ),
              const SizedBox(height: 12),
              _num(
                'standardDayHours',
                'Standard day (hours)',
                _std,
                hint: 'Overtime and hourly-rate basis',
              ),
              const SizedBox(height: 12),
              _num(
                'backdateLeaveDays',
                'Back-date leave (days)',
                _back,
                hint: 'How far back employees may apply',
              ),
              const SizedBox(height: 14),
              const HrFieldLabel('DEFAULT WEEKLY OFF'),
              HrWeekdayChips(
                selected: _off,
                enabled: edit,
                onChanged: (v) => setState(() => _off = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        const HrSectionHeader(title: 'Payroll adjustments'),
        HrCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TeamToggleRow(
                title: 'Late penalty',
                subtitle: 'Deduct pay for repeated late marks',
                value: _latePenalty,
                color: HrPalette.late,
                onChanged:
                    edit ? (v) => setState(() => _latePenalty = v) : null,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _num(
                      'latePenaltyLatesPerUnit',
                      'Lates per penalty',
                      _lpu,
                      enabled: _latePenalty,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _num(
                      'latePenaltyDays',
                      'Penalty (days)',
                      _lpd,
                      enabled: _latePenalty,
                    ),
                  ),
                ],
              ),
              const Divider(height: 28),
              TeamToggleRow(
                title: 'Overtime pay',
                subtitle: 'Pay extra beyond the standard day',
                value: _overtime,
                color: HrPalette.money,
                onChanged: edit ? (v) => setState(() => _overtime = v) : null,
              ),
              const SizedBox(height: 12),
              _num(
                'overtimeMultiplier',
                'Overtime multiplier',
                _otm,
                enabled: _overtime,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Working days = calendar days minus weekly offs (fixed rule). '
          'Holidays stay paid.',
          style: AppText.body(
            size: 11.5,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
        HrFormMessage(_serverError),
        const SizedBox(height: 14),
        if (edit)
          TeamGradientButton(
            key: const Key('policy-save'),
            label: 'Save policy',
            icon: Icons.check_rounded,
            loading: _busy,
            onTap: _busy ? null : _save,
          )
        else
          const HrReadOnlyNote('You can view the policy but not change it.'),
      ],
    );
  }
}

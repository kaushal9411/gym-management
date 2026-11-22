import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/hr_attendance.dart';
import '../../../../models/hr_admin.dart';
import '../../../../models/hr_enums.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_calendar_card.dart';
import 'hr_ui.dart';
import 'hr_widgets.dart';

/// Shared building blocks of the HR admin forms (setup, payroll editor,
/// employee forms, bulk mark). Forms live in bottom sheets / full screens -
/// never dialogs - and validate on submit with the pure functions in
/// `bloc/hr/hr_forms.dart`.

/// Money that counts up to [value] (instant under reduce-motion).
class HrMoneyCount extends StatelessWidget {
  const HrMoneyCount({
    super.key,
    required this.value,
    required this.style,
    this.prefix = '',
  });

  final double value;
  final TextStyle style;
  final String prefix;

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) {
      return Text('$prefix${Formatters.currency(value)}', style: style);
    }
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => Text(
        '$prefix${Formatters.currency(v.roundToDouble())}',
        style: style,
      ),
    );
  }
}

/// Two-step confirmation as a bottom sheet (no dialogs). Returns `true` when
/// confirmed.
Future<bool> hrConfirmSheet(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  Color color = HrPalette.absent,
  IconData icon = Icons.warning_amber_rounded,
  String cancelLabel = 'Keep it',
}) async {
  final ok = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: icon,
      color: color,
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message, style: AppText.body(color: AppColors.inkSoft)),
          const SizedBox(height: 16),
          TeamGradientButton(
            label: confirmLabel,
            gradient: LinearGradient(
              colors: [color, color.withValues(alpha: 0.75)],
            ),
            onTap: () => Navigator.of(ctx).pop(true),
          ),
          const SizedBox(height: 10),
          TeamOutlineButton(
            label: cancelLabel,
            onTap: () => Navigator.of(ctx).pop(false),
          ),
        ],
      ),
    ),
  );
  return ok == true;
}

/// Monday-first weekday toggles (`MON` ... `SUN`).
class HrWeekdayChips extends StatelessWidget {
  const HrWeekdayChips({
    super.key,
    required this.selected,
    required this.onChanged,
    this.color = HrPalette.run,
    this.enabled = true,
  });

  final List<String> selected;
  final ValueChanged<List<String>> onChanged;
  final Color color;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final d in HrWeekday.values)
          Opacity(
            opacity: enabled ? 1 : 0.5,
            child: Semantics(
              button: true,
              selected: selected.contains(d.api),
              label: '${d.short} weekly off',
              excludeSemantics: true,
              child: TeamFilterChip(
                key: Key('weekday-${d.api}'),
                label: d.short,
                selected: selected.contains(d.api),
                color: color,
                onTap: () {
                  if (!enabled) return;
                  HapticFeedback.selectionClick();
                  final next = selected.contains(d.api)
                      ? selected.where((x) => x != d.api).toList()
                      : [...selected, d.api];
                  onChanged(HrWeekday.normalise(next));
                },
              ),
            ),
          ),
      ],
    );
  }
}

/// A tappable `HH:mm` field that opens the time picker.
class HrTimeTile extends StatelessWidget {
  const HrTimeTile({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.color = HrPalette.run,
    this.errorText,
    this.clearable = false,
  });

  final String label;

  /// `HH:mm`, empty = not set.
  final String value;
  final ValueChanged<String> onChanged;
  final Color color;
  final String? errorText;
  final bool clearable;

  static TimeOfDay? parse(String hm) {
    final p = hm.split(':');
    final h = p.isNotEmpty ? int.tryParse(p.first) : null;
    final m = p.length > 1 ? int.tryParse(p[1]) : null;
    return h == null || m == null ? null : TimeOfDay(hour: h, minute: m);
  }

  static String format(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final t = parse(value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          button: true,
          label: '$label, ${value.isEmpty ? 'not set' : hrTime12(value)}',
          excludeSemantics: true,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () async {
                final picked = await showTimePicker(
                  context: context,
                  initialTime: t ?? const TimeOfDay(hour: 9, minute: 0),
                );
                if (picked != null) onChanged(format(picked));
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: errorText != null
                        ? AppColors.danger
                        : (value.isEmpty ? AppColors.line : color),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.schedule_rounded, size: 16, color: color),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: AppText.body(
                              size: 10.5,
                              weight: FontWeight.w700,
                              color: AppColors.inkFaint,
                            ),
                          ),
                          Text(
                            value.isEmpty ? 'Set time' : hrTime12(value),
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (clearable && value.isNotEmpty)
                      InkWell(
                        onTap: () => onChanged(''),
                        child: Icon(
                          Icons.close_rounded,
                          size: 16,
                          color: AppColors.inkFaint,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(
              errorText!,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ),
      ],
    );
  }
}

/// `HH:mm` -> `9:05 AM` (re-exported so forms need only this kit).
String hrTime12Of(String hm) => hrTime12(hm);

/// `‹  November 2026  ›` stepper over a `YYYY-MM` key. [max] (inclusive)
/// stops the forward arrow (payroll cannot be generated for a future month).
class HrMonthStepper extends StatelessWidget {
  const HrMonthStepper({
    super.key,
    required this.month,
    required this.onChanged,
    this.max,
  });

  final String month;
  final ValueChanged<String> onChanged;
  final String? max;

  static String shift(String key, int delta) {
    final p = key.split('-');
    final d = DateTime(int.parse(p[0]), int.parse(p[1]) + delta);
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
  }

  static String keyOf(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';

  static String currentKey() => keyOf(AppClock.today());

  @override
  Widget build(BuildContext context) {
    final canNext = max == null || month.compareTo(max!) < 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Previous month',
            onPressed: () => onChanged(shift(month, -1)),
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Expanded(
            child: Text(
              hrMonthLabelFromKey(month),
              textAlign: TextAlign.center,
              style: AppText.display(size: 16),
            ),
          ),
          IconButton(
            tooltip: 'Next month',
            onPressed: canNext ? () => onChanged(shift(month, 1)) : null,
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}

/// Section label used inside sheets (`STATUS`, `REMARK (REQUIRED)` ...).
class HrFieldLabel extends StatelessWidget {
  const HrFieldLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: AppText.eyebrow()),
      );
}

/// Inline validation / server message under a form.
class HrFormMessage extends StatelessWidget {
  const HrFormMessage(this.message, {super.key});

  final String? message;

  @override
  Widget build(BuildContext context) => message == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(top: 8),
          child: FormAlert(message: message!),
        );
}

/// Bottom sheet listing every employee (`GET /hr/employees?limit=200`) with a
/// client-side search; returns the picked [HrEmployeeRef]. [excludeUserId]
/// hides one person (e.g. yourself for "apply on behalf").
Future<HrEmployeeRef?> showHrEmployeePicker(
  BuildContext context, {
  String title = 'Choose an employee',
  String? excludeUserId,
}) {
  return showTeamSheet<HrEmployeeRef>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.badge_rounded,
      color: HrPalette.onLeave,
      title: title,
      child: _EmployeePickerBody(excludeUserId: excludeUserId),
    ),
  );
}

class _EmployeePickerBody extends StatefulWidget {
  const _EmployeePickerBody({this.excludeUserId});

  final String? excludeUserId;

  @override
  State<_EmployeePickerBody> createState() => _EmployeePickerBodyState();
}

class _EmployeePickerBodyState extends State<_EmployeePickerBody> {
  List<HrEmployee>? _all;
  String? _error;
  String _q = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final r = await getIt<HrRepository>().employees(limit: 200);
      if (mounted) setState(() => _all = r.items);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return AppErrorView(message: _error!, onRetry: _load);
    }
    final all = _all;
    if (all == null) return const HrSkeletonList(count: 4, height: 54);
    final q = _q.trim().toLowerCase();
    final list = all
        .where(
          (e) =>
              e.userId != widget.excludeUserId &&
              (q.isEmpty ||
                  e.name.toLowerCase().contains(q) ||
                  e.ref.employeeId.toLowerCase().contains(q)),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          key: const Key('hr-picker-search'),
          onChanged: (v) => setState(() => _q = v),
          style: AppText.body(),
          decoration: InputDecoration(
            hintText: 'Search name or employee ID',
            hintStyle: AppText.body(color: AppColors.inkFaint),
            prefixIcon: const Icon(Icons.search_rounded),
            filled: true,
            fillColor: AppColors.surface,
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
        const SizedBox(height: 10),
        if (list.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(
                'No employees match',
                style: AppText.body(color: AppColors.inkFaint),
              ),
            ),
          ),
        for (final e in list)
          Semantics(
            button: true,
            label: '${e.name}, ${e.ref.roleLabel}',
            excludeSemantics: true,
            child: ListTile(
              key: Key('pick-${e.userId}'),
              contentPadding: EdgeInsets.zero,
              leading: HrAvatar(employee: e.ref, size: 38),
              title: Text(
                e.name,
                style: AppText.body(size: 14, weight: FontWeight.w800),
              ),
              subtitle: Text(
                '${e.ref.employeeId} · ${e.ref.roleLabel}',
                style: AppText.body(
                  size: 11.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
              onTap: () => Navigator.of(context).pop(e.ref),
            ),
          ),
      ],
    );
  }
}

/// `+ Add` text button used by the line editors.
class HrAddButton extends StatelessWidget {
  const HrAddButton({
    super.key,
    required this.label,
    required this.onTap,
    this.color = HrPalette.run,
  });

  final String label;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.centerLeft,
        // Shrink to the button so the key / semantics cover only the button.
        widthFactor: 1,
        child: TextButton.icon(
          onPressed: onTap,
          icon: Icon(Icons.add_circle_outline_rounded, size: 18, color: color),
          label: Text(
            label,
            style: AppText.body(
              size: 13,
              weight: FontWeight.w800,
              color: onTap == null ? AppColors.inkFaint : color,
            ),
          ),
        ),
      );
}

/// A plain rounded text field in the HR sheets' style (number / text).
InputDecoration hrFieldDecoration(
  String hint, {
  String? error,
  Color? focus,
}) =>
    InputDecoration(
      hintText: hint,
      hintStyle: AppText.body(color: AppColors.inkFaint),
      errorText: error,
      filled: true,
      fillColor: AppColors.surface,
      isDense: true,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.field),
        borderSide: BorderSide(color: AppColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.field),
        borderSide: BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.field),
        borderSide: BorderSide(color: focus ?? HrPalette.run, width: 1.6),
      ),
    );

/// Gradient pill for a status / kind ("Allowance +", "Deduction -").
Color hrMoneyColor(bool allowance) =>
    allowance ? HrPalette.paid : HrPalette.absent;

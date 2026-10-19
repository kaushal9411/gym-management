import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../measurements/presentation/measurement_form.dart';
import '../../measurements/presentation/measurement_ui.dart';
import '../../measurements/presentation/member_progress.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'member_measurement_logic.dart';

/// How far back a member may back-date an entry (mirrors the API's 365-day
/// window); never the future.
const kMemberBackdateDays = 365;

/// `(first, last)` bounds for the date pickers, from a date-only [today].
(DateTime, DateTime) memberLogDateBounds(DateTime today) {
  final last = DateTime(today.year, today.month, today.day);
  return (
    DateTime(last.year, last.month, last.day - kMemberBackdateDays),
    last
  );
}

/// Saves the entry and returns the message to show once the sheet closes.
/// Throws [ApiException] (or anything) on failure — the sheet shows it inline.
typedef MeasurementSaver = Future<String> Function(
  BodyMeasurementFormInput input,
);

// ── quick weight log ────────────────────────────────────────────────────────

/// Quick weight log: weight only, today by default, +/- 0.1 kg steppers
/// prefilled from the last weight. Meant for daily use (~5 seconds). Pops the
/// success message (the caller shows it) or null when dismissed.
Future<String?> showMemberWeightSheet(
  BuildContext context, {
  required double? lastWeight,
  required Map<int, BodyMeasurement> ownByDay,
  required MeasurementSaver onSave,
  DateTime? today,
}) {
  return showTeamSheet<String>(
    context,
    (_) => MemberWeightSheet(
      lastWeight: lastWeight,
      ownByDay: ownByDay,
      onSave: onSave,
      today: today,
    ),
  );
}

class MemberWeightSheet extends StatefulWidget {
  const MemberWeightSheet({
    super.key,
    required this.lastWeight,
    required this.ownByDay,
    required this.onSave,
    this.today,
  });

  /// Latest known weight, used to prefill the stepper.
  final double? lastWeight;

  /// The member's own entries keyed by [dayOrdinal] — tells the sheet when a
  /// save will update that day's entry instead of creating one.
  final Map<int, BodyMeasurement> ownByDay;
  final MeasurementSaver onSave;
  final DateTime? today;

  @override
  State<MemberWeightSheet> createState() => _MemberWeightSheetState();
}

class _MemberWeightSheetState extends State<MemberWeightSheet> {
  static final _decimal = [
    FilteringTextInputFormatter.allow(RegExp(r'^\d*[.,]?\d{0,2}')),
  ];

  late final DateTime _today = entryDay(widget.today ?? DateTime.now());
  late DateTime _date = _today;
  late final TextEditingController _weight = TextEditingController(
    text: _initialText(),
  );
  bool _saving = false;
  String? _error;
  String? _fieldError;

  String _initialText() {
    final own = widget.ownByDay[dayOrdinal(_today)]?.weightKg;
    final v = own ?? widget.lastWeight;
    return v == null ? '' : fmtNum(v);
  }

  @override
  void dispose() {
    _weight.dispose();
    super.dispose();
  }

  bool get _updating => widget.ownByDay.containsKey(dayOrdinal(_date));

  void _nudge(double delta) {
    if (_saving) return;
    final base = parseMeasurementNumber(_weight.text) ?? widget.lastWeight;
    if (base == null) return;
    final next = r1((base + delta).clamp(0.1, MeasurementField.weight.max));
    setState(() {
      _weight.text = fmtNum(next);
      _weight.selection = TextSelection.collapsed(offset: _weight.text.length);
      _fieldError = null;
    });
  }

  void _setDate(DateTime d) {
    final day = DateTime(d.year, d.month, d.day);
    final own = widget.ownByDay[dayOrdinal(day)]?.weightKg;
    setState(() {
      _date = day;
      // Picking a day you already logged shows (and will update) that value.
      if (own != null) _weight.text = fmtNum(own);
    });
  }

  String? _validate() {
    final v = parseMeasurementNumber(_weight.text);
    if (v == null || v.isNaN || v.isInfinite) return 'Enter your weight.';
    if (v <= 0) return 'Weight must be greater than 0.';
    if (v > MeasurementField.weight.max) {
      return 'Weight cannot be more than '
          '${fmtNum(MeasurementField.weight.max)} kg.';
    }
    return null;
  }

  Future<void> _save() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _fieldError = problem);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _fieldError = null;
    });
    try {
      final message = await widget.onSave(
        BodyMeasurementFormInput(
          recordedAt: DateTime.utc(_date.year, _date.month, _date.day),
          weightKg: parseMeasurementNumber(_weight.text),
        ),
      );
      if (!mounted) return;
      Navigator.of(context).pop(message);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save your weight. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _stepper(Key key, String label, double delta) {
    return Semantics(
      button: true,
      label: '$label kg',
      child: GestureDetector(
        key: key,
        onTap: () => _nudge(delta),
        child: Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.memberB.withValues(alpha: 0.12),
            border: Border.all(color: AppColors.memberB.withValues(alpha: 0.4)),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w800,
              color: AppColors.memberB,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final (first, last) = memberLogDateBounds(_today);
    return TeamSheetScaffold(
      icon: Icons.monitor_weight_rounded,
      color: AppColors.memberB,
      title: 'Log weight',
      subtitle: widget.lastWeight == null
          ? 'One entry per day'
          : 'Last weight ${fmtNum(widget.lastWeight!)} kg · one entry per day',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              _stepper(const ValueKey('qw-minus'), '−0.1', -0.1),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(
                      color: _fieldError == null
                          ? AppColors.line
                          : AppColors.danger,
                    ),
                  ),
                  child: TextField(
                    key: const ValueKey('qw-weight'),
                    controller: _weight,
                    enabled: !_saving,
                    autofocus: widget.lastWeight == null,
                    textAlign: TextAlign.center,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: _decimal,
                    onChanged: (_) {
                      if (_fieldError != null) {
                        setState(() => _fieldError = null);
                      }
                    },
                    onSubmitted: (_) => _saving ? null : _save(),
                    style: AppText.display(size: 40),
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      disabledBorder: InputBorder.none,
                      filled: false,
                      isDense: true,
                      hintText: '0.0',
                      hintStyle: AppText.display(
                        size: 40,
                        color: AppColors.inkFaint,
                      ),
                      suffixText: 'kg',
                      suffixStyle: AppText.body(
                        size: 15,
                        weight: FontWeight.w800,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _stepper(const ValueKey('qw-plus'), '+0.1', 0.1),
            ],
          ),
          if (_fieldError != null) ...[
            const SizedBox(height: 8),
            Text(
              _fieldError!,
              key: const ValueKey('qw-error'),
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ],
          const SizedBox(height: 16),
          TeamDateField(
            key: const ValueKey('qw-date'),
            label: 'Date',
            icon: Icons.event_rounded,
            iconColor: AppColors.memberB,
            value: _date,
            firstDate: first,
            lastDate: last,
            clearable: false,
            onChanged: (d) {
              if (d != null && !_saving) _setDate(d);
            },
          ),
          if (_updating) ...[
            const SizedBox(height: 8),
            Text(
              'You already logged this day — saving will update it.',
              key: const ValueKey('qw-updating'),
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
          ],
          const SizedBox(height: 18),
          AppButton(
            key: const ValueKey('qw-save'),
            label: _updating ? 'Update weight' : 'Save weight',
            icon: Icons.check_rounded,
            role: AppRole.member,
            loading: _saving,
            onPressed: _saving ? null : _save,
          ),
        ],
      ),
    );
  }
}

// ── full check-in ───────────────────────────────────────────────────────────

/// Full weekly check-in (weight, body fat, girths, height, notes, date), used
/// to log a new check-in or — with [initial] — to edit one. Pops the success
/// message or null when dismissed.
Future<String?> showMemberCheckInSheet(
  BuildContext context, {
  required MeasurementSaver onSave,
  BodyMeasurement? initial,
  bool editing = false,
  DateTime? today,
}) {
  return showTeamSheet<String>(
    context,
    (_) => MemberCheckInSheet(
      onSave: onSave,
      initial: initial,
      editing: editing,
      today: today,
    ),
  );
}

class MemberCheckInSheet extends StatefulWidget {
  const MemberCheckInSheet({
    super.key,
    required this.onSave,
    this.initial,
    this.editing = false,
    this.today,
  });

  final MeasurementSaver onSave;

  /// Prefill: the entry being edited, or today's own entry (saving then
  /// updates it server-side — one entry per day).
  final BodyMeasurement? initial;

  /// True when [initial] is being edited (title / button wording).
  final bool editing;
  final DateTime? today;

  @override
  State<MemberCheckInSheet> createState() => _MemberCheckInSheetState();
}

class _MemberCheckInSheetState extends State<MemberCheckInSheet> {
  late final MeasurementFormController _form =
      MeasurementFormController(initial: widget.initial);
  late final DateTime _today = entryDay(widget.today ?? DateTime.now());
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // A brand-new check-in is dated by the (injectable) "today".
    if (widget.initial == null) _form.setDate(_today);
  }

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  String? _validate() {
    final problem = _form.validate();
    if (problem != null) return problem;
    final any = MeasurementField.values.any(
      (f) => _form.of(f).text.trim().isNotEmpty,
    );
    return any ? null : 'Enter at least one measurement.';
  }

  Future<void> _save() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final message = await widget.onSave(_form.toInput());
      if (!mounted) return;
      Navigator.of(context).pop(message);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save your check-in. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    var (first, last) = memberLogDateBounds(_today);
    // An old entry being edited keeps its own date selectable.
    final own =
        widget.initial == null ? null : entryDay(widget.initial!.recordedAt);
    if (own != null && own.isBefore(first)) first = own;
    final editing = widget.editing;
    return TeamSheetScaffold(
      icon: Icons.straighten_rounded,
      color: AppColors.memberB,
      title: editing ? 'Edit check-in' : 'Full check-in',
      subtitle: editing
          ? 'Update what you logged'
          : 'Weight, body fat and measurements — once a week is plenty',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          MeasurementFormFields(
            controller: _form,
            enabled: !_saving,
            firstDate: first,
            lastDate: last,
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  key: const ValueKey('ci-cancel'),
                  label: 'Cancel',
                  variant: AppButtonVariant.ghost,
                  onPressed: _saving ? null : () => Navigator.of(context).pop(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: AppButton(
                  key: const ValueKey('ci-save'),
                  label: editing ? 'Save changes' : 'Save check-in',
                  icon: Icons.check_rounded,
                  role: AppRole.member,
                  loading: _saving,
                  onPressed: _saving ? null : _save,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

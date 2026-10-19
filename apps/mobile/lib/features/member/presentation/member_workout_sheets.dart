import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_workout_tracking.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'member_workout_logic.dart';
import 'widgets/member_profile_blocks.dart';
import 'widgets/workout_day_widgets.dart';

/// Saves the details and returns the message to show once the sheet closes.
/// Throws [ApiException] (or anything) on failure — the sheet shows it inline.
typedef WorkoutDetailsSaver = Future<String> Function(WorkoutDetails details);

/// Saves the finish-workout data and returns the success message.
typedef WorkoutFinishSaver = Future<String> Function({
  int? durationMin,
  int? effort,
  String? notes,
});

// ── exercise details ────────────────────────────────────────────────────────

/// Optional sets / reps / weight / duration / note for one exercise. Pops the
/// success message, or null when dismissed.
Future<String?> showWorkoutDetailsSheet(
  BuildContext context, {
  required String title,
  required String subtitle,
  required String submitLabel,
  required WorkoutDetailsSaver onSave,
  WorkoutDetails? initial,
  String? hint,
}) {
  return showTeamSheet<String>(
    context,
    (_) => WorkoutDetailsSheet(
      title: title,
      subtitle: subtitle,
      submitLabel: submitLabel,
      onSave: onSave,
      initial: initial,
      hint: hint,
    ),
  );
}

class WorkoutDetailsSheet extends StatefulWidget {
  const WorkoutDetailsSheet({
    super.key,
    required this.title,
    required this.subtitle,
    required this.submitLabel,
    required this.onSave,
    this.initial,
    this.hint,
  });

  final String title;
  final String subtitle;
  final String submitLabel;
  final WorkoutDetailsSaver onSave;
  final WorkoutDetails? initial;

  /// e.g. "Plan: 4 x 8".
  final String? hint;

  @override
  State<WorkoutDetailsSheet> createState() => _WorkoutDetailsSheetState();
}

class _WorkoutDetailsSheetState extends State<WorkoutDetailsSheet> {
  static final _digits = [FilteringTextInputFormatter.digitsOnly];
  static final _decimal = [
    FilteringTextInputFormatter.allow(RegExp(r'^\d*[.,]?\d{0,2}')),
  ];

  late final TextEditingController _sets =
      TextEditingController(text: '${widget.initial?.setsDone ?? ''}');
  late final TextEditingController _reps =
      TextEditingController(text: '${widget.initial?.repsDone ?? ''}');
  late final TextEditingController _weight = TextEditingController(
    text: widget.initial?.weightKg == null
        ? ''
        : fmtKg(widget.initial!.weightKg!),
  );
  late final TextEditingController _duration =
      TextEditingController(text: '${widget.initial?.durationMin ?? ''}');
  late final TextEditingController _notes =
      TextEditingController(text: widget.initial?.notes ?? '');
  Map<String, String> _errors = const {};
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _sets.dispose();
    _reps.dispose();
    _weight.dispose();
    _duration.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final v = validateWorkoutDetails(
      sets: _sets.text,
      reps: _reps.text,
      weight: _weight.text,
      duration: _duration.text,
      notes: _notes.text,
    );
    if (!v.isValid) {
      setState(() => _errors = v.errors);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _errors = const {};
    });
    try {
      final message = await widget.onSave(v.details!);
      if (!mounted) return;
      Navigator.of(context).pop(message);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(
    String key,
    String label,
    TextEditingController c,
    IconData icon,
    Color color, {
    bool decimal = false,
  }) =>
      AppLabeledField(
        key: ValueKey('wd-$key'),
        label: label,
        controller: c,
        icon: icon,
        iconColor: color,
        keyboardType: TextInputType.numberWithOptions(decimal: decimal),
        inputFormatters: decimal ? _decimal : _digits,
        errorText: _errors[key],
        onChanged: (_) {
          if (_errors.containsKey(key)) {
            setState(() => _errors = {..._errors}..remove(key));
          }
        },
      );

  @override
  Widget build(BuildContext context) {
    return TeamSheetScaffold(
      icon: Icons.fitness_center_rounded,
      color: AppColors.memberB,
      title: widget.title,
      subtitle: widget.subtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          if (widget.hint != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                widget.hint!,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: AppColors.inkFaint,
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              Expanded(
                child: _field(
                  'sets',
                  'Sets done',
                  _sets,
                  Icons.layers_rounded,
                  TeamColors.indigo,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _field(
                  'reps',
                  'Reps per set',
                  _reps,
                  Icons.repeat_rounded,
                  TeamColors.violet,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _field(
                  'weight',
                  'Weight (kg)',
                  _weight,
                  Icons.scale_rounded,
                  TeamColors.amber,
                  decimal: true,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _field(
                  'duration',
                  'Minutes',
                  _duration,
                  Icons.timer_rounded,
                  TeamColors.sky,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          AppLabeledField(
            key: const ValueKey('wd-notes'),
            label: 'Note (optional)',
            controller: _notes,
            icon: Icons.sticky_note_2_rounded,
            iconColor: TeamColors.rose,
            minLines: 1,
            maxLines: 3,
            errorText: _errors['notes'],
            textCapitalization: TextCapitalization.sentences,
          ),
          const SizedBox(height: 18),
          AppButton(
            key: const ValueKey('wd-save'),
            label: widget.submitLabel,
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

// ── finish workout ──────────────────────────────────────────────────────────

/// "Finish workout": optional duration, 1-5 effort and a note. Pops the
/// success message or null when dismissed.
Future<String?> showFinishWorkoutSheet(
  BuildContext context, {
  required String dayLabel,
  required int remaining,
  required WorkoutFinishSaver onSave,
  SessionMeta? initial,
}) {
  return showTeamSheet<String>(
    context,
    (_) => FinishWorkoutSheet(
      dayLabel: dayLabel,
      remaining: remaining,
      onSave: onSave,
      initial: initial,
    ),
  );
}

class FinishWorkoutSheet extends StatefulWidget {
  const FinishWorkoutSheet({
    super.key,
    required this.dayLabel,
    required this.remaining,
    required this.onSave,
    this.initial,
  });

  final String dayLabel;
  final int remaining;
  final WorkoutFinishSaver onSave;
  final SessionMeta? initial;

  @override
  State<FinishWorkoutSheet> createState() => _FinishWorkoutSheetState();
}

class _FinishWorkoutSheetState extends State<FinishWorkoutSheet> {
  late final TextEditingController _minutes =
      TextEditingController(text: '${widget.initial?.durationMin ?? ''}');
  late final TextEditingController _notes =
      TextEditingController(text: widget.initial?.notes ?? '');
  late int? _effort = widget.initial?.effort;
  String? _minutesError;
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _minutes.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final d = validateDurationMinutes(_minutes.text);
    if (d.error != null) {
      setState(() => _minutesError = d.error);
      return;
    }
    final note = _notes.text.trim();
    if (note.length > WorkoutLimits.notesMax) {
      setState(
        () => _error =
            'Keep the note under ${WorkoutLimits.notesMax} characters.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _minutesError = null;
    });
    try {
      final message = await widget.onSave(
        durationMin: d.minutes,
        effort: _effort,
        notes: note.isEmpty ? null : note,
      );
      if (!mounted) return;
      Navigator.of(context).pop(message);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return TeamSheetScaffold(
      icon: Icons.done_all_rounded,
      color: WorkoutColors.doneSolid,
      title: 'Finish workout',
      subtitle: widget.remaining > 0
          ? '${widget.remaining} remaining '
              '${widget.remaining == 1 ? 'exercise' : 'exercises'} will be '
              'marked done for ${widget.dayLabel}'
          : 'Save how ${widget.dayLabel} went',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          AppLabeledField(
            key: const ValueKey('fw-minutes'),
            label: 'How long did it take? (min, optional)',
            controller: _minutes,
            icon: Icons.timer_rounded,
            iconColor: TeamColors.sky,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            errorText: _minutesError,
            onChanged: (_) {
              if (_minutesError != null) setState(() => _minutesError = null);
            },
          ),
          const SizedBox(height: 16),
          Text(
            'HOW HARD WAS IT? (OPTIONAL)',
            style: AppText.eyebrow(color: AppColors.inkFaint),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (var n = 1; n <= 5; n++) ...[
                if (n > 1) const SizedBox(width: 6),
                Expanded(
                  child: _EffortChip(
                    value: n,
                    selected: _effort == n,
                    onTap: _saving
                        ? null
                        : () =>
                            setState(() => _effort = _effort == n ? null : n),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          AppLabeledField(
            key: const ValueKey('fw-notes'),
            label: 'Note (optional)',
            controller: _notes,
            icon: Icons.sticky_note_2_rounded,
            iconColor: TeamColors.rose,
            minLines: 1,
            maxLines: 3,
            textCapitalization: TextCapitalization.sentences,
          ),
          const SizedBox(height: 18),
          AppButton(
            key: const ValueKey('fw-save'),
            label: 'Finish workout',
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

class _EffortChip extends StatelessWidget {
  const _EffortChip({
    required this.value,
    required this.selected,
    required this.onTap,
  });

  final int value;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        selected: selected,
        label: '$value - ${effortLabels[value]}',
        child: PressBounce(
          onTap: onTap,
          child: AnimatedContainer(
            key: ValueKey('effort-$value'),
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              gradient: selected ? AppColors.memberGrad : null,
              color: selected ? null : AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected ? Colors.transparent : AppColors.line,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$value',
                  style: AppText.display(
                    size: 18,
                    color: selected ? AppRole.member.onGradient : AppColors.ink,
                  ),
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    effortLabels[value]!,
                    maxLines: 1,
                    style: AppText.body(
                      size: 9.5,
                      weight: FontWeight.w700,
                      color: selected
                          ? AppRole.member.onGradient.withValues(alpha: 0.8)
                          : AppColors.inkFaint,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

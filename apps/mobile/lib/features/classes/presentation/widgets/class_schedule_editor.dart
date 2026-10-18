import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/group_class.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../class_ui.dart';

/// The API accepts at most 7 x 10 slots (`setScheduleSchema`).
const kMaxScheduleSlots = 70;

String _slotKey(ScheduleSlot s) => '${s.dayOfWeek.index}-${s.startTime}';

List<String> _sortedKeys(Iterable<ScheduleSlot> slots) =>
    ([for (final s in slots) _slotKey(s)]..sort());

/// Whether [a] and [b] hold the same day + time slots, ignoring order.
bool sameSlots(List<ScheduleSlot> a, List<ScheduleSlot> b) {
  final x = _sortedKeys(a), y = _sortedKeys(b);
  if (x.length != y.length) return false;
  for (var i = 0; i < x.length; i++) {
    if (x[i] != y[i]) return false;
  }
  return true;
}

/// Recurring weekly template editor — web's `ClassScheduleEditor`. A day can
/// hold more than one start time (a 7 am and a 6 pm class); the same day +
/// time can't be added twice. Seven day cards show the slots; [enabled] false
/// makes it read-only (web disables it without `classes:update`).
///
/// Holds the working list itself and reports every change through
/// [onChanged] with a `dirty` flag against [initialSlots]; give it a new
/// `key` to re-baseline after a save.
class ClassScheduleEditor extends StatefulWidget {
  const ClassScheduleEditor({
    super.key,
    required this.initialSlots,
    required this.onChanged,
    this.enabled = true,
  });

  final List<ScheduleSlot> initialSlots;
  final bool enabled;
  final void Function(List<ScheduleSlot> slots, bool dirty) onChanged;

  @override
  State<ClassScheduleEditor> createState() => _ClassScheduleEditorState();
}

class _ClassScheduleEditorState extends State<ClassScheduleEditor> {
  late List<ScheduleSlot> _slots = List.of(widget.initialSlots);
  WeekDay _day = WeekDay.monday;
  TimeOfDay _time = const TimeOfDay(hour: 7, minute: 0);
  String? _error;

  void _emit() {
    widget.onChanged(
      List.unmodifiable(_slots),
      !sameSlots(_slots, widget.initialSlots),
    );
  }

  void _add() {
    final start = hhmm(_time);
    if (_slots.any((s) => s.dayOfWeek == _day && s.startTime == start)) {
      setState(
        () => _error = '${_day.fullLabel} at ${classTime(start)} is '
            'already in the schedule.',
      );
      return;
    }
    if (_slots.length >= kMaxScheduleSlots) {
      setState(
        () => _error = 'A class can have at most $kMaxScheduleSlots '
            'weekly slots.',
      );
      return;
    }
    setState(() {
      _error = null;
      _slots = [..._slots, ScheduleSlot(dayOfWeek: _day, startTime: start)];
    });
    _emit();
  }

  void _remove(ScheduleSlot slot) {
    setState(() {
      _error = null;
      _slots = [
        for (final s in _slots)
          if (_slotKey(s) != _slotKey(slot)) s,
      ];
    });
    _emit();
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time);
    if (picked != null && mounted) setState(() => _time = picked);
  }

  List<ScheduleSlot> _forDay(WeekDay d) =>
      _slots.where((s) => s.dayOfWeek == d).toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.enabled) ...[
          Text('DAY', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final d in WeekDay.values)
                TeamFilterChip(
                  label: d.label,
                  selected: _day == d,
                  color: weekDayColor(d),
                  onTap: () => setState(() => _day = d),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('START TIME', style: AppText.eyebrow()),
                    const SizedBox(height: 8),
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        key: const ValueKey('schedule-time'),
                        borderRadius: BorderRadius.circular(AppRadii.field),
                        onTap: _pickTime,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 13,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.surface2,
                            borderRadius: BorderRadius.circular(AppRadii.field),
                            border: Border.all(color: AppColors.line),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.schedule_rounded,
                                size: 17,
                                color: weekDayColor(_day),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  classTime(hhmm(_time)),
                                  style: AppText.body(
                                    size: 14,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Icon(
                                Icons.expand_more_rounded,
                                size: 18,
                                color: AppColors.inkFaint,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                key: const ValueKey('schedule-add'),
                onTap: _add,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    gradient: TeamColors.cta,
                    borderRadius: BorderRadius.circular(AppRadii.field),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.add_rounded,
                        size: 17,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Add slot',
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w600,
                color: AppColors.danger,
              ),
            ),
          ],
          const SizedBox(height: 16),
        ],
        LayoutBuilder(
          builder: (context, c) {
            final cols = c.maxWidth >= 900 ? 4 : (c.maxWidth >= 520 ? 2 : 1);
            final width = (c.maxWidth - (cols - 1) * 10) / cols;
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final d in WeekDay.values)
                  SizedBox(
                    width: width,
                    child: _DayCard(
                      day: d,
                      slots: _forDay(d),
                      enabled: widget.enabled,
                      onRemove: _remove,
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.day,
    required this.slots,
    required this.enabled,
    required this.onRemove,
  });

  final WeekDay day;
  final List<ScheduleSlot> slots;
  final bool enabled;
  final ValueChanged<ScheduleSlot> onRemove;

  @override
  Widget build(BuildContext context) {
    final color = weekDayColor(day);
    return Container(
      key: ValueKey('schedule-day-${day.apiValue}'),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.2), Colors.transparent],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration:
                      BoxDecoration(color: color, shape: BoxShape.circle),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    day.fullLabel,
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
                ),
                if (slots.isNotEmpty)
                  Text(
                    '${slots.length}',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: color,
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
            child: slots.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(
                      'No session on this day.',
                      style: AppText.body(
                        size: 12,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  )
                : Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final s in slots)
                        Container(
                          key: ValueKey('slot-${_slotKey(s)}'),
                          padding: EdgeInsets.fromLTRB(
                            11,
                            enabled ? 3 : 7,
                            enabled ? 3 : 11,
                            enabled ? 3 : 7,
                          ),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(99),
                            border: Border.all(
                              color: color.withValues(alpha: 0.28),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                classTime(s.startTime),
                                style: AppText.body(
                                  size: 12.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                              if (enabled)
                                GestureDetector(
                                  onTap: () => onRemove(s),
                                  child: Padding(
                                    padding: const EdgeInsets.all(5),
                                    child: Icon(
                                      Icons.close_rounded,
                                      size: 15,
                                      color: AppColors.inkFaint,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

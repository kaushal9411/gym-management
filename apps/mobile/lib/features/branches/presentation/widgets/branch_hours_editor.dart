import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../branch_ui.dart';

/// What web's `BusinessHoursEditor` shows for a day that has no saved hours.
const defaultDayHours = DayHours(open: '06:00', close: '22:00');

/// All seven weekdays, filling any the branch has no hours for with
/// [defaultDayHours] (web does the same via `dayFor`).
Map<String, DayHours> normalizeHours(Map<String, DayHours> source) => {
      for (final d in branchWeekdays) d: source[d] ?? defaultDayHours,
    };

/// `"06:30"` -> minutes since midnight, or null.
int? hhmmToMinutes(String? v) {
  if (v == null) return null;
  final parts = v.split(':');
  if (parts.length < 2) return null;
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (h == null || m == null) return null;
  return h * 60 + m;
}

/// Minutes a day is open for (0 when closed, unset or the times are invalid).
int openMinutes(DayHours d) {
  if (d.closed) return 0;
  final a = hhmmToMinutes(d.open);
  final b = hhmmToMinutes(d.close);
  if (a == null || b == null || b <= a) return 0;
  return b - a;
}

String formatHours(int minutes) {
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m == 0 ? '${h}h' : '${h}h ${m}m';
}

/// Weekly schedule editor: per-day open / close time chips and an Open /
/// Closed switch, plus one-tap presets. Stateless — the parent owns [hours]
/// (always all seven days, see [normalizeHours]) and receives every change.
class BranchHoursEditor extends StatelessWidget {
  const BranchHoursEditor({
    super.key,
    required this.hours,
    required this.onChanged,
  });

  final Map<String, DayHours> hours;
  final ValueChanged<Map<String, DayHours>> onChanged;

  void _set(String day, DayHours value) => onChanged({...hours, day: value});

  Future<void> _pickTime(
    BuildContext context,
    String day, {
    required bool isOpen,
  }) async {
    final current = hours[day] ?? defaultDayHours;
    final minutes = hhmmToMinutes(isOpen ? current.open : current.close);
    final picked = await showTimePicker(
      context: context,
      initialTime: minutes == null
          ? TimeOfDay(hour: isOpen ? 6 : 22, minute: 0)
          : TimeOfDay(hour: minutes ~/ 60, minute: minutes % 60),
    );
    if (picked == null) return;
    final formatted =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    _set(
      day,
      DayHours(
        open: isOpen ? formatted : current.open,
        close: isOpen ? current.close : formatted,
        closed: current.closed,
      ),
    );
  }

  void _copyMonday() {
    final monday = hours['monday'] ?? defaultDayHours;
    onChanged({for (final d in branchWeekdays) d: monday});
  }

  void _weekendsClosed() {
    onChanged({
      for (final d in branchWeekdays)
        d: (d == 'saturday' || d == 'sunday')
            ? DayHours(
                open: hours[d]?.open,
                close: hours[d]?.close,
                closed: true,
              )
            : hours[d] ?? defaultDayHours,
    });
  }

  void _openAllDays() {
    onChanged({
      for (final d in branchWeekdays)
        d: DayHours(
          open: hours[d]?.open ?? defaultDayHours.open,
          close: hours[d]?.close ?? defaultDayHours.close,
        ),
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = hours.values.fold(0, (a, d) => a + openMinutes(d));
    final openDays = hours.values.where((d) => !d.closed).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _QuickChip(
              icon: Icons.copy_all_rounded,
              label: 'Monday to all days',
              onTap: _copyMonday,
            ),
            _QuickChip(
              icon: Icons.weekend_rounded,
              label: 'Weekends closed',
              onTap: _weekendsClosed,
            ),
            _QuickChip(
              icon: Icons.event_available_rounded,
              label: 'Open every day',
              onTap: _openAllDays,
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (final day in branchWeekdays)
          _DayRow(
            day: day,
            hours: hours[day] ?? defaultDayHours,
            isToday: day == todayKey(),
            onOpen: () => _pickTime(context, day, isOpen: true),
            onClose: () => _pickTime(context, day, isOpen: false),
            onToggle: () {
              final d = hours[day] ?? defaultDayHours;
              _set(
                day,
                DayHours(open: d.open, close: d.close, closed: !d.closed),
              );
            },
          ),
        const SizedBox(height: 4),
        Row(
          children: [
            const Icon(
              Icons.schedule_rounded,
              size: 14,
              color: TeamColors.teal,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                'Open $openDays ${openDays == 1 ? 'day' : 'days'} a week'
                ' · ${formatHours(total)} in total',
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: AppColors.inkSoft,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _QuickChip extends StatelessWidget {
  const _QuickChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: TeamColors.teal.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: TeamColors.teal.withValues(alpha: 0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: TeamColors.teal),
            const SizedBox(width: 5),
            Text(
              label,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w800,
                color: TeamColors.teal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({
    required this.day,
    required this.hours,
    required this.isToday,
    required this.onOpen,
    required this.onClose,
    required this.onToggle,
  });

  final String day;
  final DayHours hours;
  final bool isToday;
  final VoidCallback onOpen;
  final VoidCallback onClose;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final closed = hours.closed;
    final a = hhmmToMinutes(hours.open);
    final b = hhmmToMinutes(hours.close);
    final invalid = !closed && a != null && b != null && b <= a;
    final tone = closed ? AppColors.inkFaint : TeamColors.teal;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
      decoration: BoxDecoration(
        color: closed
            ? AppColors.surface3.withValues(alpha: 0.5)
            : TeamColors.teal.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: invalid
              ? AppColors.danger
              : isToday
                  ? TeamColors.violet
                  : tone.withValues(alpha: 0.25),
          width: isToday || invalid ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                kDayFull[day]!,
                style: AppText.body(size: 13.5, weight: FontWeight.w800),
              ),
              if (isToday) ...[
                const SizedBox(width: 8),
                const TeamTag(label: 'Today', color: TeamColors.violet),
              ],
              const Spacer(),
              GestureDetector(
                onTap: onToggle,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: closed ? null : TeamColors.ctaGreen,
                    color: closed ? AppColors.surface3 : null,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    closed ? 'Closed' : 'Open',
                    style: AppText.body(
                      size: 11,
                      weight: FontWeight.w800,
                      color: closed ? AppColors.inkSoft : Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (!closed) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _TimeChip(label: hours.open ?? '--:--', onTap: onOpen),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    'to',
                    style: AppText.body(size: 11, color: AppColors.inkFaint),
                  ),
                ),
                Expanded(
                  child:
                      _TimeChip(label: hours.close ?? '--:--', onTap: onClose),
                ),
              ],
            ),
          ],
          if (invalid)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Closing time must be after the opening time.',
                style: AppText.body(
                  size: 11,
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

class _TimeChip extends StatelessWidget {
  const _TimeChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.access_time_rounded,
              size: 13,
              color: TeamColors.teal,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: AppText.body(size: 12.5, weight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

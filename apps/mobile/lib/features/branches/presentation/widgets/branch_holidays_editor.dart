import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../team/presentation/widgets/team_ui.dart';

/// `holidays` is capped at 100 entries by the API.
const kMaxHolidays = 100;

const _months = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

const _weekdayNames = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/// Holidays sorted by date (oldest first); entries with an unparseable date
/// keep their relative order at the end.
List<BranchHoliday> sortedHolidays(Iterable<BranchHoliday> holidays) {
  final list = holidays.toList();
  list.sort((a, b) => a.date.compareTo(b.date));
  return list;
}

/// Whole days from today (local) to [date]; negative = in the past.
int daysFromToday(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return DateTime(date.year, date.month, date.day).difference(today).inDays;
}

/// A date tile + label row for one holiday; [onRemove] adds the delete button.
class HolidayTile extends StatelessWidget {
  const HolidayTile({super.key, required this.holiday, this.onRemove});

  final BranchHoliday holiday;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final date = holiday.parsed;
    final diff = date == null ? null : daysFromToday(date);
    final past = diff != null && diff < 0;
    final color = past ? AppColors.inkFaint : TeamColors.violet;
    final when = diff == null
        ? ''
        : diff == 0
            ? 'Today'
            : diff == 1
                ? 'Tomorrow'
                : diff > 1
                    ? 'In $diff days'
                    : diff == -1
                        ? 'Yesterday'
                        : '${-diff} days ago';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(10, 9, 6, 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: past ? 0.05 : 0.09),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: BoxDecoration(
              gradient: past
                  ? null
                  : const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [TeamColors.violet, TeamColors.fuchsia],
                    ),
              color: past ? AppColors.surface3 : null,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  date == null ? '--' : '${date.day}',
                  style: AppText.display(
                    size: 17,
                    color: past ? AppColors.inkSoft : Colors.white,
                  ),
                ),
                Text(
                  date == null ? '' : _months[date.month - 1],
                  style: AppText.body(
                    size: 9.5,
                    weight: FontWeight.w800,
                    color: past
                        ? AppColors.inkFaint
                        : Colors.white.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  holiday.label?.isNotEmpty == true ? holiday.label! : 'Closed',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
                Text(
                  date == null
                      ? holiday.date
                      : '${_weekdayNames[date.weekday - 1]}, ${fmtDate(date)}'
                          '${when.isEmpty ? '' : ' · $when'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          if (onRemove != null)
            IconButton(
              tooltip: 'Remove holiday',
              visualDensity: VisualDensity.compact,
              icon: const Icon(
                Icons.delete_outline_rounded,
                size: 20,
                color: AppColors.danger,
              ),
              onPressed: onRemove,
            ),
        ],
      ),
    );
  }
}

/// Add / remove list of one-off closures (`{date: YYYY-MM-DD, label?}`) on top
/// of the weekly hours. The parent owns [holidays]; every change goes through
/// [onChanged] with a date-sorted list. Owns its own label controller and date
/// field state (never created in `build`).
class BranchHolidaysEditor extends StatefulWidget {
  const BranchHolidaysEditor({
    super.key,
    required this.holidays,
    required this.onChanged,
  });

  final List<BranchHoliday> holidays;
  final ValueChanged<List<BranchHoliday>> onChanged;

  @override
  State<BranchHolidaysEditor> createState() => _BranchHolidaysEditorState();
}

class _BranchHolidaysEditorState extends State<BranchHolidaysEditor> {
  final _label = TextEditingController();
  DateTime? _date;
  String? _error;

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  void _add() {
    final date = _date;
    if (date == null) {
      setState(() => _error = 'Pick a date first.');
      return;
    }
    final iso = isoDate(date);
    if (widget.holidays.any((h) => h.date == iso)) {
      setState(() => _error = 'That date is already on the list.');
      return;
    }
    if (widget.holidays.length >= kMaxHolidays) {
      setState(
        () => _error = 'A branch can have up to $kMaxHolidays holidays.',
      );
      return;
    }
    final label = _label.text.trim();
    widget.onChanged(
      sortedHolidays([
        ...widget.holidays,
        BranchHoliday(date: iso, label: label.isEmpty ? null : label),
      ]),
    );
    _label.clear();
    setState(() {
      _date = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final sorted = sortedHolidays(widget.holidays);
    final upcoming = sorted.where((h) {
      final d = h.parsed;
      return d == null || daysFromToday(d) >= 0;
    }).toList();
    final past = sorted.where((h) {
      final d = h.parsed;
      return d != null && daysFromToday(d) < 0;
    }).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TeamDateField(
                label: 'Date',
                icon: Icons.event_rounded,
                iconColor: TeamColors.violet,
                value: _date,
                firstDate: DateTime(now.year - 1),
                lastDate: DateTime(now.year + 6, 12, 31),
                onChanged: (d) => setState(() {
                  _date = d;
                  _error = null;
                }),
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Label (optional)',
                hintText: 'e.g. Diwali',
                icon: Icons.label_rounded,
                iconColor: TeamColors.fuchsia,
                controller: _label,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _add(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(
                  _error!,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w700,
                    color: AppColors.danger,
                  ),
                ),
              ],
              const SizedBox(height: 12),
              TeamGradientButton(
                label: 'Add holiday',
                icon: Icons.add_rounded,
                onTap: _add,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (sorted.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'No holidays added yet. Dates added here close the branch on '
              'top of its weekly hours.',
              style: AppText.body(size: 12.5, color: AppColors.inkFaint),
            ),
          )
        else ...[
          if (upcoming.isNotEmpty) ...[
            TeamGroupLabel('Upcoming · ${upcoming.length}'),
            for (final h in upcoming)
              HolidayTile(
                key: ValueKey('h-${h.date}'),
                holiday: h,
                onRemove: () => widget.onChanged(
                  sorted.where((x) => x != h).toList(),
                ),
              ),
          ],
          if (past.isNotEmpty) ...[
            TeamGroupLabel('Past · ${past.length}'),
            for (final h in past)
              HolidayTile(
                key: ValueKey('h-${h.date}'),
                holiday: h,
                onRemove: () => widget.onChanged(
                  sorted.where((x) => x != h).toList(),
                ),
              ),
          ],
        ],
      ],
    );
  }
}

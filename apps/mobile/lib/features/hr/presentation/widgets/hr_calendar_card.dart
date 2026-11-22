import 'package:flutter/material.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../models/hr_attendance.dart';
import '../../../../models/hr_enums.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_ui.dart';
import 'hr_widgets.dart';

/// One-line spoken/visible summary of a day ("In 9:05 AM · Out 5:30 PM").
String hrDaySummary(HrAttendanceDay d) {
  final parts = <String>[d.status.label];
  if (d.holidayName != null) parts.add(d.holidayName!);
  if (d.leaveType != null) parts.add(d.leaveType!.name);
  if (d.checkInTime != null) parts.add('in ${_t12(d.checkInTime!)}');
  if (d.checkOutTime != null) parts.add('out ${_t12(d.checkOutTime!)}');
  return parts.join(', ');
}

/// `15:30` -> `3:30 PM` (the API's IST `HH:mm`).
String _t12(String hm) {
  final p = hm.split(':');
  final h = int.tryParse(p.first);
  final m = p.length > 1 ? int.tryParse(p[1]) : null;
  if (h == null || m == null) return hm;
  final hh = h % 12 == 0 ? 12 : h % 12;
  return '$hh:${m.toString().padLeft(2, '0')} ${h < 12 ? 'AM' : 'PM'}';
}

/// Public wrapper so other screens format `HH:mm` the same way.
String hrTime12(String? hm) => hm == null ? '–' : _t12(hm);

HrCalendarCell hrCellFor(HrAttendanceDay d) {
  final muted =
      d.status == DayStatus.notMarked || d.status == DayStatus.notJoined;
  return HrCalendarCell(
    color: HrPalette.status(d.status),
    glyph: HrPalette.glyph(d.status),
    muted: muted,
    semantics: hrDaySummary(d),
  );
}

/// Month heatmap + month navigation + month totals, for one employee. Used by
/// My HR (self) and the employee HR detail (HR). Fetching is injected so both
/// callers share this widget; a change of [refreshKey] (e.g. after a punch)
/// reloads the visible month.
class HrAttendanceCalendarCard extends StatefulWidget {
  const HrAttendanceCalendarCard({
    super.key,
    required this.fetch,
    this.refreshKey,
    this.initial,
    this.subject,
    this.onMark,
  });

  final Future<HrMonthAttendance> Function(String month) fetch;
  final Object? refreshKey;

  /// Already-fetched current month (skips the first request).
  final HrMonthAttendance? initial;

  /// Whose attendance this is (sheet title); null = "My attendance".
  final String? subject;

  /// HR-only: shows "Mark / edit attendance" in the day sheet.
  final Future<void> Function(HrAttendanceDay day)? onMark;

  @override
  State<HrAttendanceCalendarCard> createState() =>
      _HrAttendanceCalendarCardState();
}

class _HrAttendanceCalendarCardState extends State<HrAttendanceCalendarCard> {
  late DateTime _month =
      DateTime(AppClock.today().year, AppClock.today().month);
  HrMonthAttendance? _data;
  bool _loading = true;
  String? _error;
  int? _selected;
  int _req = 0;

  DateTime get _currentMonth =>
      DateTime(AppClock.today().year, AppClock.today().month);

  String get _monthKey =>
      '${_month.year.toString().padLeft(4, '0')}-${_month.month.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    if (widget.initial != null && widget.initial!.month == _monthKey) {
      _data = widget.initial;
      _loading = false;
    } else {
      _load();
    }
  }

  @override
  void didUpdateWidget(HrAttendanceCalendarCard old) {
    super.didUpdateWidget(old);
    if (old.refreshKey != widget.refreshKey) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    final req = ++_req;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final d = await widget.fetch(_monthKey);
      if (!mounted || req != _req) return;
      setState(() {
        _data = d;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted || req != _req) return;
      setState(() {
        _loading = false;
        if (_data == null || !silent) _error = e.message;
      });
    }
  }

  void _shift(int delta) {
    final next = DateTime(_month.year, _month.month + delta);
    if (next.isAfter(_currentMonth)) return;
    setState(() {
      _month = next;
      _selected = null;
      _data = null;
    });
    _load();
  }

  Future<void> _openDay(int day) async {
    final rec = _data?.byDay[day];
    setState(() => _selected = day);
    if (rec == null) return;
    await showHrDaySheet(
      context,
      rec,
      subject: widget.subject,
      onMark: widget.onMark == null
          ? null
          : () async {
              await widget.onMark!(rec);
              if (mounted) _load(silent: true);
            },
    );
    if (mounted) setState(() => _selected = null);
  }

  @override
  Widget build(BuildContext context) {
    final isCurrent = _month.year == _currentMonth.year &&
        _month.month == _currentMonth.month;
    final data = _data;
    final cells = <int, HrCalendarCell>{
      if (data != null)
        for (final e in data.byDay.entries) e.key: hrCellFor(e.value),
    };
    return HrCard(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _NavButton(
                icon: Icons.chevron_left_rounded,
                label: 'Previous month',
                onTap: () => _shift(-1),
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  child: Text(
                    hrMonthLabel(_month.year, _month.month),
                    key: ValueKey(_monthKey),
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 16),
                  ),
                ),
              ),
              _NavButton(
                icon: Icons.chevron_right_rounded,
                label: 'Next month',
                onTap: isCurrent ? null : () => _shift(1),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (data != null) _MonthChips(stats: data.stats),
          const SizedBox(height: 12),
          if (_loading && data == null)
            const HrShimmerBox(height: 250, radius: 16)
          else if (_error != null && data == null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 18),
              child: Column(
                children: [
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: AppText.body(color: AppColors.danger, size: 13),
                  ),
                  TextButton(onPressed: _load, child: const Text('Retry')),
                ],
              ),
            )
          else
            AnimatedOpacity(
              opacity: _loading ? 0.5 : 1,
              duration: const Duration(milliseconds: 180),
              child: HrMonthCalendar(
                month: _month,
                cells: cells,
                selectedDay: _selected,
                todayDay: isCurrent ? AppClock.today().day : null,
                onDayTap: _openDay,
              ),
            ),
          const SizedBox(height: 4),
          HrLegend(
            items: [
              for (final s in HrPalette.legend)
                (s.label, HrPalette.status(s), HrPalette.glyph(s)),
            ],
          ),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(
              icon,
              size: 24,
              color: onTap == null ? AppColors.line : AppColors.ink,
            ),
          ),
        ),
      ),
    );
  }
}

class _MonthChips extends StatelessWidget {
  const _MonthChips({required this.stats});

  final HrAttendanceStats stats;

  @override
  Widget build(BuildContext context) {
    final items = <(String, int, DayStatus)>[
      ('Present', stats.present, DayStatus.present),
      ('Late', stats.late, DayStatus.late),
      ('Half', stats.halfDay, DayStatus.halfDay),
      ('Leave', stats.onLeave, DayStatus.onLeave),
      ('Absent', stats.absent, DayStatus.absent),
    ];
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final i in items)
          if (i.$2 > 0)
            HrChip(
              label: '${i.$1} ${i.$2}',
              color: HrPalette.status(i.$3),
              dense: true,
            ),
        if (stats.workedMinutes > 0)
          HrChip(
            label: hrDuration(stats.workedMinutes),
            icon: Icons.timer_outlined,
            color: AppColors.inkSoft,
            dense: true,
          ),
      ],
    );
  }
}

/// Day detail: status, punches, worked / late / overtime, where the record
/// came from, and - for manual marks - who marked it and why.
Future<void> showHrDaySheet(
  BuildContext context,
  HrAttendanceDay d, {
  String? subject,
  Future<void> Function()? onMark,
}) {
  final color = HrPalette.status(d.status);
  return showTeamSheet<void>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: HrPalette.glyph(d.status),
      color: color,
      title: hrDateWd(d.date),
      subtitle: subject ?? 'My attendance',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HrDayStatusChip(status: d.status, dense: false),
              if (d.leaveDayPart != null && d.leaveDayPart!.isHalf) ...[
                const SizedBox(width: 8),
                HrChip(
                  label: d.leaveDayPart!.label,
                  color: HrPalette.onLeave,
                  dense: true,
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          if (d.holidayName != null)
            HrInfoRow(
              label: 'Holiday',
              value: d.holidayName!,
              icon: Icons.celebration_rounded,
            ),
          if (d.leaveType != null)
            HrInfoRow(
              label: 'Leave type',
              value: d.leaveType!.name,
              icon: Icons.beach_access_rounded,
            ),
          if (d.shift != null)
            HrInfoRow(
              label: 'Shift',
              value: '${d.shift!.name} · ${hrTime12(d.shift!.startTime)} – '
                  '${hrTime12(d.shift!.endTime)}',
              icon: Icons.schedule_rounded,
            ),
          HrInfoRow(
            label: 'Check in',
            value: hrTime12(d.checkInTime),
            icon: Icons.login_rounded,
          ),
          HrInfoRow(
            label: 'Check out',
            value: hrTime12(d.checkOutTime),
            icon: Icons.logout_rounded,
          ),
          if (d.workedMinutes != null)
            HrInfoRow(
              label: 'Worked',
              value: hrDuration(d.workedMinutes!),
              icon: Icons.timer_outlined,
            ),
          if (d.lateMinutes > 0)
            HrInfoRow(
              label: 'Late by',
              value: hrDuration(d.lateMinutes),
              icon: Icons.running_with_errors_rounded,
              valueColor: HrPalette.late,
            ),
          if (d.overtimeMinutes > 0)
            HrInfoRow(
              label: 'Overtime',
              value: hrDuration(d.overtimeMinutes),
              icon: Icons.more_time_rounded,
            ),
          if (d.recorded && d.source != null)
            HrInfoRow(
              label: 'Recorded',
              value: switch (d.source) {
                'SELF' => 'Self check-in',
                'MANUAL' => d.markedBy == null
                    ? 'Marked by HR'
                    : 'Marked by ${d.markedBy!.name}',
                'SYSTEM' => 'From approved leave',
                _ => d.source!,
              },
              icon: Icons.fact_check_outlined,
            ),
          if (!d.recorded)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'No attendance record - this day is worked out from the '
                'calendar.',
                style: AppText.body(
                  size: 12,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          if (d.remark != null && d.remark!.isNotEmpty) ...[
            const SizedBox(height: 10),
            HrRemark(
              who: d.isManual ? (d.markedBy?.name ?? 'HR') : null,
              remark: d.remark!,
              color: color,
            ),
          ],
          if (onMark != null) ...[
            const SizedBox(height: 14),
            TeamGradientButton(
              label: d.recorded ? 'Edit attendance' : 'Mark attendance',
              icon: Icons.edit_calendar_rounded,
              onTap: () async {
                Navigator.of(ctx).pop();
                await onMark();
              },
            ),
          ],
        ],
      ),
    ),
  );
}

/// Rounded "pill" holding an eyebrow + value - used for the hero chips.
class HrHeroChip extends StatelessWidget {
  const HrHeroChip({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.white),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

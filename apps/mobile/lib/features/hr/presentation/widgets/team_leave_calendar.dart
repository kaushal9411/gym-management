import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/hr/hr_load_cubit.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../models/hr_enums.dart';
import '../../../../models/hr_leave.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../hr_palette.dart';
import 'hr_form_kit.dart';
import 'hr_ui.dart';
import 'hr_widgets.dart';

/// The data of one month of the team leave calendar.
class HrTeamMonth {
  const HrTeamMonth({required this.leaves, required this.holidays});

  /// PENDING + APPROVED requests overlapping the month.
  final List<HrLeaveRequest> leaves;
  final List<HrHoliday> holidays;
}

/// Day-of-month -> the requests covering it, for [month] (`YYYY-MM`). A
/// request that starts before / ends after the month is clipped to it.
Map<int, List<HrLeaveRequest>> hrLeavesByDay(
  List<HrLeaveRequest> leaves,
  String month,
) {
  final p = month.split('-');
  final y = int.parse(p[0]);
  final m = int.parse(p[1]);
  final last = DateTime(y, m + 1, 0).day;
  final out = <int, List<HrLeaveRequest>>{};
  for (final l in leaves) {
    if (l.status != LeaveStatus.pending && l.status != LeaveStatus.approved) {
      continue;
    }
    for (var d = 1; d <= last; d++) {
      final date = DateTime(y, m, d);
      if (!date.isBefore(l.startDate) && !date.isAfter(l.endDate)) {
        (out[d] ??= []).add(l);
      }
    }
  }
  return out;
}

/// **Team leave calendar** - who is off when (`GET /hr/leaves?from&to`,
/// `hr:leave_manage`, plus the month's holidays). The month grid tints each day
/// with the leave type's hue (holidays in fuchsia), pending days carry an
/// hourglass instead of a tick, and tapping a day lists the people off with
/// type, dates, part of day and status.
class HrTeamLeaveCalendar extends StatefulWidget {
  const HrTeamLeaveCalendar({super.key, this.reloadKey = 0});

  final int reloadKey;

  @override
  State<HrTeamLeaveCalendar> createState() => _HrTeamLeaveCalendarState();
}

class _HrTeamLeaveCalendarState extends State<HrTeamLeaveCalendar> {
  String _month = HrMonthStepper.currentKey();
  late int _picked = _initialPick();
  late final HrLoadCubit<HrTeamMonth> _cubit = HrLoadCubit(_fetch)..load();

  int _initialPick() {
    final t = AppClock.today();
    return HrMonthStepper.keyOf(t) == _month ? t.day : 1;
  }

  Future<HrTeamMonth> _fetch() async {
    final p = _month.split('-');
    final y = int.parse(p[0]);
    final m = int.parse(p[1]);
    final from = DateTime(y, m, 1);
    final to = DateTime(y, m + 1, 0);
    final repo = getIt<HrRepository>();
    final r = await repo.leaves(limit: 100, from: from, to: to);
    final h = await repo.holidaysBetween(from, to);
    return HrTeamMonth(
      leaves: r.page.items
          .where(
            (l) =>
                l.status == LeaveStatus.pending ||
                l.status == LeaveStatus.approved,
          )
          .toList(),
      holidays: h,
    );
  }

  @override
  void didUpdateWidget(HrTeamLeaveCalendar old) {
    super.didUpdateWidget(old);
    if (old.reloadKey != widget.reloadKey) _cubit.load(silent: true);
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HrMonthStepper(
          month: _month,
          onChanged: (m) {
            setState(() {
              _month = m;
              _picked = 1;
            });
            _cubit.load();
          },
        ),
        const SizedBox(height: 12),
        BlocBuilder<HrLoadCubit<HrTeamMonth>, HrLoadState<HrTeamMonth>>(
          bloc: _cubit,
          builder: (context, state) => switch (state) {
            HrLoadLoading() => const HrShimmerBox(
                height: 330,
                radius: AppRadii.card,
              ),
            HrLoadError(:final message) => AppErrorView(
                message: message,
                onRetry: _cubit.load,
              ),
            HrLoadLoaded(:final data) => _body(data),
          },
        ),
      ],
    );
  }

  Widget _body(HrTeamMonth data) {
    final p = _month.split('-');
    final first = DateTime(int.parse(p[0]), int.parse(p[1]));
    final byDay = hrLeavesByDay(data.leaves, _month);
    final holidays = {for (final h in data.holidays) h.date.day: h};
    final today = AppClock.today();
    final cells = <int, HrCalendarCell>{};
    for (var d = 1; d <= HrMonthCalendar.daysInMonth(first); d++) {
      final list = byDay[d] ?? const <HrLeaveRequest>[];
      final holiday = holidays[d];
      if (holiday == null && list.isEmpty) continue;
      final date = DateTime(first.year, first.month, d);
      final allPending =
          list.isNotEmpty && list.every((l) => l.status == LeaveStatus.pending);
      cells[d] = HrCalendarCell(
        color: holiday != null
            ? HrPalette.holiday
            : HrPalette.leaveType(list.first.leaveType.colorHex),
        glyph: holiday != null
            ? Icons.celebration_rounded
            : (allPending
                ? Icons.hourglass_top_rounded
                : Icons.beach_access_rounded),
        semantics: '${hrDateWd(date)}'
            '${holiday != null ? ', holiday ${holiday.name}' : ''}'
            ', ${list.length} on leave',
      );
    }
    final dayList = byDay[_picked] ?? const <HrLeaveRequest>[];
    final holiday = holidays[_picked];
    final pickedDate = DateTime(first.year, first.month, _picked);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HrCard(
          key: const Key('team-calendar'),
          child: HrMonthCalendar(
            month: first,
            cells: cells,
            selectedDay: _picked,
            todayDay: HrMonthStepper.keyOf(today) == _month ? today.day : null,
            onDayTap: (d) => setState(() => _picked = d),
          ),
        ),
        const SizedBox(height: 8),
        const HrLegend(
          items: [
            ('Approved leave', HrPalette.onLeave, Icons.beach_access_rounded),
            ('Pending', HrPalette.pending, Icons.hourglass_top_rounded),
            ('Holiday', HrPalette.holiday, Icons.celebration_rounded),
          ],
        ),
        HrSectionHeader(
          title: hrDateWd(pickedDate),
        ),
        if (holiday != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: HrRemark(
              remark: 'Holiday: ${holiday.name}',
              color: HrPalette.holiday,
            ),
          ),
        if (dayList.isEmpty && holiday == null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(
              'Everyone is in - nobody is on leave this day.',
              key: const Key('calendar-empty'),
              style: AppText.body(color: AppColors.inkFaint),
            ),
          ),
        for (final l in dayList) ...[
          _DayLeaveRow(leave: l),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _DayLeaveRow extends StatelessWidget {
  const _DayLeaveRow({required this.leave});

  final HrLeaveRequest leave;

  @override
  Widget build(BuildContext context) {
    final l = leave;
    final hue = HrPalette.leaveType(l.leaveType.colorHex);
    final pending = l.status == LeaveStatus.pending;
    final dates = l.isSingleDay
        ? hrDateWd(l.startDate)
        : '${hrDate(l.startDate)} – ${hrDate(l.endDate)}';
    return Semantics(
      container: true,
      label: '${l.employee.name}, ${l.leaveType.name}, $dates, '
          '${l.dayPart.label}, ${l.status.label}',
      child: HrCard(
        accent: hue,
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            HrAvatar(employee: l.employee, size: 34),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.employee.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 13.5, weight: FontWeight.w800),
                  ),
                  Text(
                    '${l.leaveType.name} · $dates',
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
            HrChip(
              label: l.dayPart.isHalf
                  ? (l.dayPart == DayPart.halfMorning ? 'AM half' : 'PM half')
                  : (pending ? 'Pending' : 'Full day'),
              color: pending ? HrPalette.pending : hue,
              icon: pending
                  ? Icons.hourglass_top_rounded
                  : HrPalette.dayPart(l.dayPart),
              dense: true,
            ),
          ],
        ),
      ),
    );
  }
}

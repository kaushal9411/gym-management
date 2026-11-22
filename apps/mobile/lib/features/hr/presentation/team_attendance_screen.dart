import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_clock.dart';
import '../../../models/hr_attendance.dart';
import '../../../models/hr_enums.dart';
import '../../../models/hr_setup.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'hr_palette.dart';
import 'widgets/attendance_bulk_sheet.dart';
import 'widgets/hr_calendar_card.dart';
import 'widgets/hr_sheets.dart';
import 'widgets/monthly_grid_view.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// **Team attendance** for one day - `GET /hr/attendance?date=` (`hr:view`).
///
/// A day stepper (previous / next, tap the date for a calendar; nothing after
/// today), the day's totals as filter chips, and one row per employee: status,
/// check-in / check-out, late minutes and a MANUAL badge with the remark when
/// HR marked it. With `hr:attendance_manage` a tap opens the **manual mark**
/// sheet - status, optional times, and a REQUIRED remark (stored on the record
/// and shown to the employee); a recorded day can also be removed. Without it
/// the tap shows the read-only day detail.
///
/// **Month grid** (second view, same screen like the web tabs): employee x day
/// with a status colour + glyph per cell and P / A totals; tapping a cell opens
/// the same manual-mark form (`hr:attendance_manage`) or the read-only day
/// sheet. **Mark all present** (day view, `hr:attendance_manage`) bulk-marks
/// everyone without a record with one shared, required remark.
///
/// Not on mobile: the branch filter of the web board (the API scopes the
/// roster to the user's branches already).
enum _AttView {
  day('Day view'),
  month('Month grid');

  const _AttView(this.label);

  final String label;
}

/// Route argument of the attendance screen (`AppRoutes.hrTeamAttendance`).
class HrAttendanceArgs {
  const HrAttendanceArgs({this.monthGrid = false});

  /// Open on the monthly grid instead of the day roster.
  final bool monthGrid;
}

class TeamAttendanceScreen extends StatefulWidget {
  const TeamAttendanceScreen({super.key, this.monthGrid = false});

  final bool monthGrid;

  @override
  State<TeamAttendanceScreen> createState() => _TeamAttendanceScreenState();
}

class _TeamAttendanceScreenState extends State<TeamAttendanceScreen> {
  DateTime _date = AppClock.today();
  HrDayBoard? _board;
  String? _error;
  bool _loading = true;
  String _search = '';
  DayStatus? _filter;
  int _req = 0;
  late _AttView _view = widget.monthGrid ? _AttView.month : _AttView.day;
  int _gridKey = 0;

  @override
  void initState() {
    super.initState();
    // The month grid loads its own data; the day roster only when shown.
    if (_view == _AttView.day) _load();
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
      final b = await getIt<HrRepository>().dayBoard(
        date: hrIso(_date),
        search: _search,
      );
      if (!mounted || req != _req) return;
      setState(() {
        _board = b;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted || req != _req) return;
      if (_board == null || !silent) setState(() => _error = e.message);
    } finally {
      if (mounted && req == _req) setState(() => _loading = false);
    }
  }

  bool get _isToday => _date == AppClock.today();

  void _step(int days) {
    final next = _date.add(Duration(days: days));
    if (next.isAfter(AppClock.today())) return;
    HapticFeedback.selectionClick();
    setState(() {
      _date = DateTime(next.year, next.month, next.day);
      _board = null;
      _filter = null;
    });
    _load();
  }

  Future<void> _pickDate() async {
    final today = AppClock.today();
    final d = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: today.subtract(const Duration(days: 365)),
      lastDate: today,
    );
    if (d == null || !mounted) return;
    setState(() {
      _date = DateTime(d.year, d.month, d.day);
      _board = null;
      _filter = null;
    });
    _load();
  }

  Future<void> _bulk() async {
    final b = _board;
    if (b == null) return;
    final changed = await showBulkMarkSheet(context, date: _date, rows: b.rows);
    if (changed && mounted) _load(silent: true);
  }

  /// A grid cell only knows its status, so read that day's board to get the
  /// full record (punches, source, remark) before opening the form.
  Future<void> _openCell(HrGridRow row, DateTime date) async {
    final canMark = hrCan(context, HrPerm.attendanceManage);
    HrAttendanceDay? existing;
    try {
      final board = await getIt<HrRepository>().dayBoard(date: hrIso(date));
      for (final r in board.rows) {
        if (r.employee.userId == row.employee.userId) existing = r.attendance;
      }
    } on ApiException catch (e) {
      if (mounted) hrSnack(context, e.message, error: true);
      return;
    }
    if (!mounted) return;
    if (canMark && !date.isAfter(AppClock.today())) {
      final changed = await showMarkAttendanceSheet(
        context,
        employee: row.employee,
        date: date,
        existing: existing,
      );
      if (changed && mounted) setState(() => _gridKey++);
    } else if (existing != null) {
      await showHrDaySheet(context, existing, subject: row.employee.name);
    }
  }

  Future<void> _open(HrBoardRow row) async {
    if (hrCan(context, HrPerm.attendanceManage)) {
      final changed = await showMarkAttendanceSheet(
        context,
        employee: row.employee,
        date: _date,
        existing: row.attendance,
      );
      if (changed && mounted) _load(silent: true);
    } else {
      await showHrDaySheet(
        context,
        row.attendance,
        subject: row.employee.name,
      );
    }
  }

  List<HrBoardRow> get _rows {
    final b = _board;
    if (b == null) return const [];
    return _filter == null
        ? b.rows
        : b.rows.where((r) => r.attendance.status == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final b = _board;
    final rows = _rows;
    final canMark = hrCan(context, HrPerm.attendanceManage);
    return HrPage(
      title: 'Team attendance',
      subtitle: hrDateWd(_date) + (_isToday ? ' · today' : ''),
      onRefresh: () => _load(silent: true),
      chips: [
        if (b != null) ...[
          ListHeroChip(
            icon: Icons.check_circle_rounded,
            label: '${b.summary.present + b.summary.late} in',
          ),
          ListHeroChip(
            icon: Icons.beach_access_rounded,
            label: '${b.summary.onLeave} on leave',
          ),
        ],
      ],
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                for (final v in _AttView.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Semantics(
                      button: true,
                      selected: _view == v,
                      label: '${v.label} view',
                      excludeSemantics: true,
                      child: TeamFilterChip(
                        key: Key('att-view-${v.name}'),
                        label: v.label,
                        selected: _view == v,
                        color: HrPalette.present,
                        onTap: () {
                          setState(() => _view = v);
                          if (v == _AttView.day && _board == null) _load();
                        },
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (_view == _AttView.month)
          SliverToBoxAdapter(
            child: HrMonthlyGridView(
              reloadKey: _gridKey,
              onCell: _openCell,
            ),
          )
        else ...[
          SliverToBoxAdapter(
            child: _DayStepper(
              date: _date,
              isToday: _isToday,
              onPrev: () => _step(-1),
              onNext: _isToday ? null : () => _step(1),
              onPick: _pickDate,
            ),
          ),
          if (canMark && b != null && !_date.isAfter(AppClock.today())) ...[
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
            SliverToBoxAdapter(
              child: TeamOutlineButton(
                key: const Key('mark-all-present'),
                label: 'Mark all present',
                icon: Icons.how_to_reg_rounded,
                onTap: _bulk,
              ),
            ),
          ],
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: TeamSearchField(
              hint: 'Search employees',
              onSearch: (v) {
                _search = v;
                _load(silent: true);
              },
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          if (b != null)
            SliverToBoxAdapter(
              child: _SummaryChips(
                summary: b.summary,
                selected: _filter,
                onPick: (s) =>
                    setState(() => _filter = s == _filter ? null : s),
              ),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          if (_loading && b == null)
            const SliverToBoxAdapter(
              child: HrSkeletonList(count: 5, height: 74),
            )
          else if (_error != null && b == null)
            SliverToBoxAdapter(
              child: AppErrorView(message: _error!, onRetry: _load),
            )
          else if (rows.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(top: 30),
                child: AppEmptyState(
                  title: 'No employees to show',
                  message: 'Nobody matches this filter for the day.',
                  icon: Icons.groups_outlined,
                ),
              ),
            )
          else
            SliverList.separated(
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => StaggeredCard(
                index: i,
                child: _AttendanceRow(
                  row: rows[i],
                  canMark: canMark,
                  onTap: () => _open(rows[i]),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _DayStepper extends StatelessWidget {
  const _DayStepper({
    required this.date,
    required this.isToday,
    required this.onPrev,
    required this.onNext,
    required this.onPick,
  });

  final DateTime date;
  final bool isToday;
  final VoidCallback onPrev;
  final VoidCallback? onNext;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Previous day',
            onPressed: onPrev,
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Expanded(
            child: Semantics(
              button: true,
              label: 'Pick a date, ${hrDateY(date)}',
              excludeSemantics: true,
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: onPick,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    transitionBuilder: (c, a) => FadeTransition(
                      opacity: a,
                      child: SlideTransition(
                        position: Tween(
                          begin: const Offset(0, 0.25),
                          end: Offset.zero,
                        ).animate(a),
                        child: c,
                      ),
                    ),
                    child: Column(
                      key: ValueKey(date),
                      children: [
                        Text(
                          isToday ? 'Today' : hrDateWd(date),
                          style: AppText.display(size: 17),
                        ),
                        Text(
                          hrDateY(date),
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w700,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Next day',
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}

class _SummaryChips extends StatelessWidget {
  const _SummaryChips({
    required this.summary,
    required this.selected,
    required this.onPick,
  });

  final HrAttendanceStats summary;
  final DayStatus? selected;
  final ValueChanged<DayStatus> onPick;

  @override
  Widget build(BuildContext context) {
    final items = <(DayStatus, int)>[
      (DayStatus.present, summary.present),
      (DayStatus.late, summary.late),
      (DayStatus.halfDay, summary.halfDay),
      (DayStatus.onLeave, summary.onLeave),
      (DayStatus.absent, summary.absent),
      (DayStatus.weeklyOff, summary.weeklyOff),
      (DayStatus.holiday, summary.holiday),
      (DayStatus.notMarked, summary.notMarked),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final i in items)
            if (i.$2 > 0 || selected == i.$1)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: TeamFilterChip(
                  label: '${i.$1.label} · ${i.$2}',
                  selected: selected == i.$1,
                  color: HrPalette.status(i.$1),
                  onTap: () => onPick(i.$1),
                ),
              ),
        ],
      ),
    );
  }
}

class _AttendanceRow extends StatelessWidget {
  const _AttendanceRow({
    required this.row,
    required this.canMark,
    required this.onTap,
  });

  final HrBoardRow row;
  final bool canMark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = row.attendance;
    final c = HrPalette.status(a.status);
    final times = a.hasCheckedIn
        ? '${hrTime12(a.checkInTime)} – ${a.hasCheckedOut ? hrTime12(a.checkOutTime) : 'working'}'
        : (a.status == DayStatus.onLeave
            ? (a.leaveType?.name ?? 'On leave')
            : (a.holidayName ?? row.shift?.name ?? ''));
    return Semantics(
      button: true,
      label: '${row.employee.name}, ${hrDaySummary(a)}'
          '${canMark ? ', double tap to mark attendance' : ''}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    HrAvatar(employee: row.employee, size: 42),
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          color: c,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.surface,
                            width: 2,
                          ),
                        ),
                        child: Icon(
                          HrPalette.glyph(a.status),
                          size: 10,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.employee.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        [
                          row.employee.roleLabel,
                          if (times.isNotEmpty) times,
                        ].where((s) => s.isNotEmpty).join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                      if (a.isManual && a.remark != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.edit_note_rounded,
                                size: 13,
                                color: HrPalette.onLeave,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  a.remark!,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: 11,
                                    weight: FontWeight.w700,
                                    color: HrPalette.onLeave,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    HrDayStatusChip(status: a.status),
                    if (a.lateMinutes > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '+${a.lateMinutes} min late',
                          style: AppText.body(
                            size: 10.5,
                            weight: FontWeight.w800,
                            color: HrPalette.late,
                          ),
                        ),
                      ),
                  ],
                ),
                if (canMark) ...[
                  const SizedBox(width: 6),
                  Icon(
                    Icons.edit_calendar_rounded,
                    size: 17,
                    color: AppColors.inkFaint,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

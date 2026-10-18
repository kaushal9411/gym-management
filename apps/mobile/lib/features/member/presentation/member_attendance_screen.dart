import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_overview.dart';
import '../../../models/member_visit.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamCenter, TeamColors;
import 'widgets/member_dash_ui.dart';
import 'widgets/member_insights.dart';

/// My Attendance — web's `/portal/attendance`, redesigned for the member
/// plane (member palette).
///
/// Same content as web: a hero ("N visits this month", last visit, change vs
/// last month, average visit, Streak / Best / Total), four tiles (This month
/// with delta, Current streak with progress to the best, Avg visit, Busiest
/// day), the 12-week heatmap with weekday bars, and the **Visit history**:
/// a month filter (when more than one month is loaded), visits grouped by
/// day, each row with branch, check-in → check-out (or "in progress"), the
/// duration, a "Checked in" chip while inside and the check-in method, and
/// Load more (30 at a time, API cap 100). Tapping a visit opens the visit
/// detail page.
///
/// `GET /portal/attendance` is critical; `GET /portal/overview` only feeds the
/// stats — if it fails the stats sections are hidden and the history stays.
///
/// Dropped vs web: heatmap hover (long-press tooltip) and the separate
/// weekday card (shown inside the heatmap card).
class MemberAttendanceScreen extends StatefulWidget {
  const MemberAttendanceScreen({super.key});

  @override
  State<MemberAttendanceScreen> createState() => _MemberAttendanceScreenState();
}

class _MemberAttendanceScreenState extends State<MemberAttendanceScreen> {
  static const _page = 30;
  static const _max = 100;

  List<MemberVisit> _visits = const [];
  int _total = 0;
  int _limit = _page;
  MemberOverview? _overview;
  bool _loading = true;
  bool _more = false;
  String? _error;
  String _month = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    final repo = getIt<MemberPortalRepository>();
    setState(() {
      if (more) {
        _more = true;
      } else {
        _loading = _visits.isEmpty;
      }
      _error = null;
    });
    if (!more) {
      repo.overview().then((o) {
        if (mounted) setState(() => _overview = o);
      }).catchError((_) {});
    }
    try {
      final r = await repo.attendance(limit: _limit);
      if (!mounted) return;
      setState(() {
        _visits = r.items;
        _total = r.total;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load your visits ($e)');
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _more = false;
        });
      }
    }
  }

  Future<void> _loadMore() {
    _limit = (_limit + _page).clamp(0, _max);
    return _load(more: true);
  }

  String _monthKey(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}';

  List<String> get _months {
    final keys = _visits
        .map((v) => _monthKey(v.attendanceDate))
        .toSet()
        .toList()
      ..sort((a, b) => b.compareTo(a));
    return keys.take(6).toList();
  }

  String _monthLabel(String key) {
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final p = key.split('-');
    return "${m[int.parse(p[1]) - 1]} '${p[0].substring(2)}";
  }

  String _dur(Duration d) {
    final min = d.inMinutes;
    return min >= 60 ? '${min ~/ 60}h ${min % 60}m' : '${min}m';
  }

  String _pretty(String s) {
    final t = s.toLowerCase().replaceAll('_', ' ');
    return t.isEmpty ? t : t[0].toUpperCase() + t.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: _loading
          ? const AppLoadingView(role: AppRole.member)
          : _error != null && _visits.isEmpty
              ? AppErrorView(
                  message: _error!,
                  onRetry: _load,
                  role: AppRole.member,
                )
              : RefreshIndicator(
                  color: AppColors.memberB,
                  backgroundColor: AppColors.surface2,
                  onRefresh: _load,
                  child: _content(),
                ),
    );
  }

  Widget _content() {
    final o = _overview?.attendance;
    final last = o?.lastVisitAt == null
        ? null
        : DateTime.tryParse(o!.lastVisitAt!)?.toLocal();
    final diff = o == null ? 0 : o.thisMonthVisits - o.previousMonthVisits;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        MemberPageHero(
          eyebrow: 'Attendance',
          title: o == null
              ? 'My attendance'
              : '${o.thisMonthVisits} '
                  '${o.thisMonthVisits == 1 ? 'visit' : 'visits'} this month',
          subtitle: last == null
              ? 'Your check-ins show up here'
              : 'Last visit ${formatVisitDay(last)} at ${formatClock(last)}',
          chips: [
            if (o != null && diff != 0)
              '${diff > 0 ? '▲' : '▼'} ${diff.abs()} vs last month',
            if (o?.avgVisitMinutes != null && o!.avgVisitMinutes! > 0)
              '~${o.avgVisitMinutes} min per visit',
          ],
          stats: o == null
              ? const []
              : [
                  ('Streak', o.currentStreakDays, (n) => '${n}d'),
                  ('Best', o.bestStreakDays, (n) => '${n}d'),
                  ('Total', o.totalVisits, (n) => '$n'),
                ],
        ),
        TeamCenter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (o != null) ...[
                  _tiles(o),
                  const SizedBox(height: 14),
                  StaggeredReveal(
                    index: 1,
                    child: AttendanceHeatmapCard(attendance: o),
                  ),
                  const SizedBox(height: 14),
                ],
                _history(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _tiles(OverviewAttendance a) {
    const names = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', //
      'Sunday',
    ];
    const api = [1, 2, 3, 4, 5, 6, 0];
    final counts = {for (final w in a.weekday) w.weekday: w.count};
    final maxWd = a.maxWeekday;
    final busiest = maxWd == 0
        ? null
        : names[api.indexWhere((i) => (counts[i] ?? 0) == maxWd)];
    return MemberTileGrid(
      tiles: [
        MemberStatTile(
          label: 'This month',
          icon: Icons.event_available_rounded,
          color: AppColors.memberB,
          value: AnimatedNumber(
            value: a.thisMonthVisits.toDouble(),
            format: (v) => '${v.round()}',
          ),
          hint: '${a.previousMonthVisits} last month',
          delta: a.deltaPercent,
        ),
        MemberStatTile(
          label: 'Current streak',
          icon: Icons.local_fire_department_rounded,
          color: const Color(0xFFF97316),
          value: AnimatedNumber(
            value: a.currentStreakDays.toDouble(),
            format: (v) => '${v.round()}d',
          ),
          hint: 'Best ${a.bestStreakDays} days',
          progress:
              a.bestStreakDays > 0 ? a.currentStreakDays / a.bestStreakDays : 0,
        ),
        MemberStatTile(
          label: 'Avg visit',
          icon: Icons.timer_outlined,
          color: TeamColors.sky,
          value: Text(
            a.avgVisitMinutes == null || a.avgVisitMinutes == 0
                ? '—'
                : _dur(Duration(minutes: a.avgVisitMinutes!)),
          ),
          hint: 'Check-in to check-out',
        ),
        MemberStatTile(
          label: 'Busiest day',
          icon: Icons.emoji_events_outlined,
          color: TeamColors.violet,
          value: Text(busiest ?? '—'),
          hint: busiest == null ? 'No pattern yet' : '$maxWd visits',
        ),
      ],
    );
  }

  Widget _history() {
    final months = _months;
    final filtered = _month == 'all'
        ? _visits
        : _visits.where((v) => _monthKey(v.attendanceDate) == _month).toList();
    final groups = <String, List<MemberVisit>>{};
    for (final v in filtered) {
      final d = v.attendanceDate;
      final k = '${d.year}-${d.month.toString().padLeft(2, '0')}-'
          '${d.day.toString().padLeft(2, '0')}';
      groups.putIfAbsent(k, () => []).add(v);
    }
    final canMore = _visits.length < _total && _limit < _max;
    return MemberSection(
      title: 'Visit history',
      subtitle: _total > 0 ? '$_total check-ins in total' : null,
      icon: Icons.login_rounded,
      color: TeamColors.green,
      flush: true,
      child: _visits.isEmpty
          ? const MemberEmpty(
              icon: Icons.event_busy_outlined,
              title: 'No visits yet',
              message: 'Your check-in history will show up here after your '
                  'first visit.',
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (months.length > 1)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                    child: FilterChipsRow<String>(
                      role: AppRole.member,
                      selected: _month,
                      onSelected: (v) => setState(() => _month = v),
                      options: [
                        const FilterChipOption('all', 'All'),
                        for (final m in months)
                          FilterChipOption(m, _monthLabel(m)),
                      ],
                    ),
                  ),
                if (groups.isEmpty)
                  const MemberEmpty(
                    icon: Icons.calendar_month_outlined,
                    title: 'No visits in this month',
                    message: 'Pick another month.',
                  ),
                for (final e in groups.entries) ...[
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    color: AppColors.surface3,
                    child: Text(
                      formatVisitDay(e.value.first.attendanceDate),
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                  for (final v in e.value) _row(v),
                ],
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    children: [
                      Text(
                        'Showing ${_visits.length} of $_total',
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                      if (canMore)
                        TextButton(
                          key: const ValueKey('att-more'),
                          onPressed: _more ? null : _loadMore,
                          child: Text(_more ? 'Loading…' : 'Load more'),
                        )
                      else if (_visits.length < _total)
                        Text(
                          'Showing your latest $_max visits.',
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _row(MemberVisit v) {
    final inside = v.checkOutTime == null;
    final d = v.duration;
    return MemberListRow(
      icon: inside ? Icons.login_rounded : Icons.schedule_rounded,
      color: inside ? TeamColors.green : AppColors.memberB,
      title: v.branchName,
      subtitle: '${formatClock(v.checkInTime)} → '
          '${inside ? 'in progress' : formatClock(v.checkOutTime!)}'
          '  ·  ${_pretty(v.method)}',
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (d != null && d.inMinutes >= 0)
            AppPill(label: _dur(d), tone: AppPillTone.neutral),
          if (inside)
            const AppPill(label: 'Checked in', tone: AppPillTone.success),
        ],
      ),
      onTap: () => context.push(AppRoutes.memberVisitDetail, extra: v),
    );
  }
}

String formatClock(DateTime time) {
  final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;
  final minute = time.minute.toString().padLeft(2, '0');
  return '$hour:$minute ${time.hour < 12 ? 'AM' : 'PM'}';
}

String formatVisitDay(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(date.year, date.month, date.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${date.day} ${months[date.month - 1]}';
}

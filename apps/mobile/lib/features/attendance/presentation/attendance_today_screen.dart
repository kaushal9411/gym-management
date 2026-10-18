import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_summary.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'attendance_access.dart';
import 'attendance_sheets.dart';
import 'attendance_ui.dart';

/// Attendance, today's view — web's `/attendance` dashboard.
///
/// Used in two places, same widget, two modes:
/// * [asTab] `false` (default) — the pushed `/attendance/dashboard` route
///   (Owner / Receptionist / Trainer menu tiles): all branches by default,
///   with a branch picker; History and Check in / out stay available to
///   everyone who can open it, exactly as before the redesign.
/// * [asTab] `true` — the Manager shell's Attendance tab: **always scoped to
///   the manager's own primary branch** (the `/attendance/*` endpoints are not
///   auto-scoped server-side, so a `GET /staff/:id` self-lookup supplies
///   `branchId`, same as before), no branch picker. It loads once and
///   refreshes by pull-to-refresh (IndexedStack tab-cache rule).
///
/// Layout: gradient [ListHero] (live "inside now" pulse + counters), four KPI
/// tiles and four insight panels that open bottom sheets (daily trend, week
/// vs last week, today's methods, busiest hours), then today's activity as
/// rich visit cards with search + status chips; tapping a card opens its
/// detail sheet (check out / edit / delete when permitted).
///
/// **Dropped vs. web**: nothing with an endpoint. The 30-day trend comes from
/// the single `/attendance/summary?dateFrom&dateTo` call (like web); the
/// method donut and busiest-hours bars are computed from `/attendance/today`
/// (capped at 500 rows server-side).
class AttendanceTodayScreen extends StatefulWidget {
  const AttendanceTodayScreen({super.key, this.asTab = false});

  final bool asTab;

  @override
  State<AttendanceTodayScreen> createState() => _AttendanceTodayScreenState();
}

class _AttendanceTodayScreenState extends State<AttendanceTodayScreen> {
  AttendanceSummary? _summary;
  List<AttendanceRecord>? _today;
  List<BranchOption> _branches = [];
  String? _branchId;
  bool _loading = true;
  String? _error;

  // Manager tab: own primary branch, resolved once.
  bool _ownResolved = false;
  String? _ownBranchId;
  String? _ownBranchName;

  String _search = '';
  String _statusFilter = ''; // '', 'in', 'out'
  String? _busyId;

  @override
  void initState() {
    super.initState();
    if (!widget.asTab) _loadBranches();
    _load();
  }

  Future<void> _loadBranches() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() => _branches = options);
    } catch (_) {
      // Non-fatal — the picker just offers "All branches".
    }
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      String? branchId = _branchId;
      if (widget.asTab) {
        if (!_ownResolved) {
          final session = context.read<SessionCubit>().state;
          if (session is SessionAuthenticatedStaff) {
            final self =
                await getIt<StaffRepository>().getById(session.user.id);
            _ownBranchId = self.primaryBranch?.branchId;
            _ownBranchName = self.primaryBranch?.branchName;
          }
          _ownResolved = true;
        }
        branchId = _ownBranchId;
      }
      final now = DateTime.now();
      final repo = getIt<AttendanceRepository>();
      final res = await Future.wait<Object>([
        repo.summary(
          branchId: branchId,
          dateFrom: now.subtract(const Duration(days: 29)),
          dateTo: now,
        ),
        repo.today(branchId: branchId),
      ]);
      if (!mounted) return;
      setState(() {
        _summary = res[0] as AttendanceSummary;
        _today = res[1] as List<AttendanceRecord>;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load attendance ($e)');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_summary != null) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  // ── derived ───────────────────────────────────────────────────────────────

  List<AttendanceRecord> get _all => _today ?? const [];
  List<AttendanceRecord> get _inside => _all.where((r) => r.isInside).toList();

  List<AttendanceRecord> get _visible {
    final q = _search.toLowerCase();
    return _all.where((r) {
      if (_statusFilter == 'in' && !r.isInside) return false;
      if (_statusFilter == 'out' && r.isInside) return false;
      if (q.isEmpty) return true;
      return r.memberName.toLowerCase().contains(q) ||
          (r.memberCode ?? '').toLowerCase().contains(q);
    }).toList();
  }

  String get _branchLabel {
    if (widget.asTab) return _ownBranchName ?? 'Your branch';
    for (final b in _branches) {
      if (b.id == _branchId) return b.name;
    }
    return 'All branches';
  }

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branchId,
      clearLabel: 'All branches',
    );
    if (v == null) return;
    setState(() => _branchId = v.isEmpty ? null : v);
    _load();
  }

  Future<void> _history() async {
    await context.push(AppRoutes.attendanceHistory);
    if (mounted) _load(silent: true);
  }

  Future<void> _checkInFlow() async {
    await context.push(AppRoutes.searchMembers);
    if (mounted) _load(silent: true);
  }

  Future<void> _open(AttendanceRecord r) async {
    final changed = await showAttendanceDetailSheet(context, r);
    if (changed && mounted) _load(silent: true);
  }

  Future<void> _quickCheckOut(AttendanceRecord r) async {
    setState(() => _busyId = r.id);
    final ok = await checkOutRecord(context, r);
    if (!mounted) return;
    setState(() => _busyId = null);
    if (ok) _load(silent: true);
  }

  void _sheet({
    required String title,
    required IconData icon,
    required Color color,
    required List<AttendanceRecord> records,
    String? subtitle,
    String emptyText = 'Nothing here right now.',
  }) {
    showAttendanceListSheet(
      context,
      title: title,
      icon: icon,
      color: color,
      records: records,
      subtitle: subtitle,
      emptyText: emptyText,
      showBranch: !widget.asTab && _branchId == null,
      onChanged: () => _load(silent: true),
    );
  }

  void _onKpi(int i) {
    switch (i) {
      case 0:
        _sheet(
          title: 'Check-ins today',
          icon: Icons.login_rounded,
          color: TeamColors.green,
          records: _all,
          emptyText: 'No check-ins recorded today.',
        );
      case 1:
        _sheet(
          title: 'Check-outs today',
          icon: Icons.logout_rounded,
          color: TeamColors.teal,
          records: _all.where((r) => r.checkOutTime != null).toList(),
          emptyText: 'Nobody has checked out yet today.',
        );
      case 2:
        _sheet(
          title: 'Currently inside',
          icon: Icons.meeting_room_rounded,
          color: TeamColors.indigo,
          records: _inside,
          emptyText: 'No one is checked in right now.',
        );
      default:
        showAttendanceHoursSheet(
          context,
          checkInsByHour(_all),
          peakHour: _summary?.peakCheckInHour,
        );
    }
  }

  // ── KPIs + insights ───────────────────────────────────────────────────────

  List<AttendanceKpi> _kpis() {
    final s = _summary;
    final m = computeAttendanceTrend(s?.trend ?? const []);
    return [
      AttendanceKpi(
        label: 'Check-ins today',
        value: s?.totalCheckInsToday ?? 0,
        color: TeamColors.green,
        icon: Icons.login_rounded,
        delta: s == null ? null : m.todayDeltaPct,
      ),
      AttendanceKpi(
        label: 'Check-outs today',
        value: s?.totalCheckOutsToday ?? 0,
        color: TeamColors.teal,
        icon: Icons.logout_rounded,
      ),
      AttendanceKpi(
        label: 'Currently inside',
        value: s?.currentlyInside ?? 0,
        color: TeamColors.indigo,
        icon: Icons.meeting_room_rounded,
      ),
      AttendanceKpi(
        label: 'Peak check-in time',
        text: fmtHour(s?.peakCheckInHour),
        color: TeamColors.violet,
        icon: Icons.schedule_rounded,
      ),
    ];
  }

  Widget _insights() {
    final s = _summary!;
    final trend = s.trend;
    final m = computeAttendanceTrend(trend);
    final hasTrend = trend.length >= 2 && trend.any((d) => d.count > 0);
    final byMethod = <String, int>{};
    for (final r in _all) {
      final k = r.method ?? 'UNKNOWN';
      byMethod[k] = (byMethod[k] ?? 0) + 1;
    }
    final byHour = checkInsByHour(_all);
    return TeamAdaptive(
      children: [
        TeamInsightCard(
          icon: Icons.show_chart_rounded,
          title: 'Attendance trend',
          color: TeamColors.indigo,
          trailing: 'Last ${trend.length} days',
          onTap: () => showAttendanceTrendSheet(context, trend),
          child: hasTrend
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DrawnSparkline(
                      values: [for (final d in trend) d.count.toDouble()],
                      colors: const [TeamColors.indigo, TeamColors.violet],
                      height: 76,
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'This week ${m.thisWeekSum} · '
                            'Last week ${m.lastWeekSum}',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: AppColors.inkSoft,
                            ),
                          ),
                        ),
                        AttendanceDeltaChip(pct: m.weekDeltaPct),
                      ],
                    ),
                  ],
                )
              : Text(
                  'No check-ins in this period yet.',
                  style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                ),
        ),
        TeamInsightCard(
          icon: Icons.compare_arrows_rounded,
          title: 'This week vs last week',
          color: TeamColors.violet,
          onTap: () => showAttendanceWeekSheet(context, m),
          child: m.weekdayPairs.every((p) => p.$2 == 0 && p.$3 == 0)
              ? Text(
                  'Not enough history yet.',
                  style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                )
              : AttendancePairedBars(pairs: m.weekdayPairs),
        ),
        TeamInsightCard(
          icon: Icons.donut_large_rounded,
          title: "Today's methods",
          color: TeamColors.teal,
          trailing: byMethod.isEmpty ? null : '${_all.length} visits',
          onTap: byMethod.isEmpty ? null : () => _methodsSheet(byMethod),
          child: byMethod.isEmpty
              ? Text(
                  'No check-ins recorded today.',
                  style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                )
              : DonutChart(
                  size: 84,
                  slices: [
                    for (final e in byMethod.entries)
                      DonutSlice(
                        label: attendanceMethodLabel(e.key),
                        value: e.value,
                        color: attendanceMethodColor(e.key),
                      ),
                  ],
                ),
        ),
        TeamInsightCard(
          icon: Icons.access_time_filled_rounded,
          title: 'Busiest hours today',
          color: TeamColors.amber,
          trailing: s.peakCheckInHour == null
              ? null
              : 'Peak ${fmtHour(s.peakCheckInHour)}',
          onTap: () => showAttendanceHoursSheet(
            context,
            byHour,
            peakHour: s.peakCheckInHour,
          ),
          child: AttendanceHourBars(byHour: byHour),
        ),
      ],
    );
  }

  void _methodsSheet(Map<String, int> byMethod) {
    final keys = byMethod.keys.toList()
      ..sort((a, b) => byMethod[b]!.compareTo(byMethod[a]!));
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: Icons.donut_large_rounded,
        title: "Today's methods",
        subtitle: '${_all.length} visits',
        color: TeamColors.teal,
        child: TeamBarRows(
          showPercent: true,
          rows: [
            for (final k in keys) (attendanceMethodLabel(k), byMethod[k]!),
          ],
          colors: [for (final k in keys) attendanceMethodColor(k)],
          onRowTap: (i) {
            Navigator.of(sheetContext).pop();
            _sheet(
              title: attendanceMethodLabel(keys[i]),
              icon: attendanceMethodIcon(keys[i]),
              color: attendanceMethodColor(keys[i]),
              records: _all
                  .where((r) => (r.method ?? 'UNKNOWN') == keys[i])
                  .toList(),
            );
          },
        ),
      ),
    );
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = widget.asTab ? 0.0 : MediaQuery.of(context).padding.top;
    final access = AttendanceAccess.of(context);
    final showCheckIn = access.showCheckIn(asTab: widget.asTab);
    final bottom = widget.asTab ? AppSpacing.screenBottomWithNav : 32.0;

    final body = RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => _load(silent: true),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _hero(top, access)),
          if (_summary != null && _today != null) ...[
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!widget.asTab && _branches.isNotEmpty) ...[
                        TeamToolbarButton(
                          icon: Icons.storefront_rounded,
                          label: _branchLabel,
                          active: _branchId != null,
                          onTap: _pickBranch,
                        ),
                        const SizedBox(height: 12),
                      ],
                      AttendanceKpiGrid(tiles: _kpis(), onTap: _onKpi),
                      if (showCheckIn) ...[
                        const SizedBox(height: 14),
                        TeamGradientButton(
                          label: 'Check in / out a member',
                          icon: Icons.qr_code_scanner_rounded,
                          onTap: _checkInFlow,
                        ),
                      ],
                      const SizedBox(height: 14),
                      _insights(),
                      const SizedBox(height: 18),
                      _activityHeader(),
                    ],
                  ),
                ),
              ),
            ),
            ..._activity(access, bottom),
          ] else if (_loading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: AppLoadingView(),
            )
          else
            SliverFillRemaining(
              hasScrollBody: false,
              child: AppErrorView(
                message: _error ?? 'Could not load attendance.',
                onRetry: _load,
              ),
            ),
        ],
      ),
    );

    // The Manager tab sits inside the shell's Scaffold; the pushed route
    // needs its own.
    if (widget.asTab) return body;
    return Scaffold(backgroundColor: AppColors.bg, body: body);
  }

  Widget _activityHeader() {
    final all = _all;
    final inside = _inside.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text("Today's activity", style: AppText.display(size: 18)),
            ),
            TeamTag(
              label: '${all.length}',
              color: TeamColors.green,
              icon: Icons.groups_rounded,
            ),
          ],
        ),
        const SizedBox(height: 10),
        TeamSearchField(
          hint: 'Search member name or ID…',
          onSearch: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              TeamFilterChip(
                label: 'All · ${all.length}',
                selected: _statusFilter.isEmpty,
                color: TeamColors.indigo,
                onTap: () => setState(() => _statusFilter = ''),
              ),
              const SizedBox(width: 8),
              TeamFilterChip(
                label: 'Inside · $inside',
                selected: _statusFilter == 'in',
                color: TeamColors.green,
                onTap: () => setState(() => _statusFilter = 'in'),
              ),
              const SizedBox(width: 8),
              TeamFilterChip(
                label: 'Checked out · ${all.length - inside}',
                selected: _statusFilter == 'out',
                color: TeamColors.slate,
                onTap: () => setState(() => _statusFilter = 'out'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
      ],
    );
  }

  List<Widget> _activity(AttendanceAccess access, double bottom) {
    final items = _visible;
    if (items.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: AppEmptyState(
              icon: Icons.event_busy_rounded,
              title: _all.isEmpty
                  ? 'No attendance recorded yet today'
                  : 'No visits match',
              message: _all.isEmpty
                  ? 'Check-ins will show up here as they happen.'
                  : 'Try a different search or filter.',
            ),
          ),
        ),
        SliverToBoxAdapter(child: SizedBox(height: bottom)),
      ];
    }
    return [
      teamCardSliver<AttendanceRecord>(
        context,
        items: items,
        padding: EdgeInsets.fromLTRB(18, 0, 18, bottom),
        builder: (r, i) => FadeUp(
          index: i.clamp(0, 6),
          child: AttendanceRecordCard(
            key: ValueKey('visit-${r.id}'),
            record: r,
            showBranch: !widget.asTab && _branchId == null,
            busy: _busyId == r.id,
            onTap: () => _open(r),
            onCheckOut: access.canCheckOut ? () => _quickCheckOut(r) : null,
          ),
        ),
      ),
    ];
  }

  Widget _hero(double top, AttendanceAccess access) {
    final s = _summary;
    return ListHero(
      title: 'Attendance',
      subtitle: 'Today · $_branchLabel',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: widget.asTab
          ? ListHeroButton(
              icon: Icons.menu_rounded,
              onTap: () => SlideDrawerController.of(context)?.open(),
            )
          : ListHeroButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => context.pop(),
            ),
      trailing: [
        if (access.showHistory(asTab: widget.asTab))
          ListHeroButton(icon: Icons.history_rounded, onTap: _history),
        if (access.showCheckIn(asTab: widget.asTab))
          ListHeroButton(
            icon: Icons.qr_code_scanner_rounded,
            onTap: _checkInFlow,
          ),
      ],
      chips: [
        if (s != null) ...[
          AttendanceLiveChip(label: '${s.currentlyInside} inside now'),
          ListHeroChip(
            icon: Icons.login_rounded,
            label: '${s.totalCheckInsToday} check-ins',
          ),
          ListHeroChip(
            icon: Icons.logout_rounded,
            label: '${s.totalCheckOutsToday} check-outs',
          ),
          if (s.peakCheckInHour != null)
            ListHeroChip(
              icon: Icons.schedule_rounded,
              label: 'Peak ${fmtHour(s.peakCheckInHour)}',
            ),
        ],
      ],
    );
  }
}

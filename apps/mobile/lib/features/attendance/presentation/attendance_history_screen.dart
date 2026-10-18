import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_summary.dart';
import '../../../models/branch_option.dart';
import '../../../models/paginated_result.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'attendance_access.dart';
import 'attendance_sheets.dart';
import 'attendance_ui.dart';

const _sorts = [
  ('checkInTime:desc', 'Newest check-in first'),
  ('checkInTime:asc', 'Oldest check-in first'),
];

const _statusOptions = [
  (label: 'All', value: '', color: TeamColors.indigo),
  (label: 'Inside', value: 'CHECKED_IN', color: TeamColors.green),
  (label: 'Checked out', value: 'CHECKED_OUT', color: TeamColors.slate),
];

/// Quick date ranges; `custom` opens the range picker.
enum _Range { today, week, month30, thisMonth, all, custom }

const _rangeLabels = {
  _Range.today: 'Today',
  _Range.week: '7 days',
  _Range.month30: '30 days',
  _Range.thisMonth: 'This month',
  _Range.all: 'All time',
};

/// Attendance History — web's `/attendance/history` (`GET /attendance`).
///
/// Tenant-wide and filterable exactly as before the redesign (search, branch,
/// status, date range — **no** implicit branch scoping; a branch is sent only
/// when picked) plus web's method filter and sort. Gradient [ListHero] with
/// today's glance (check-ins / check-outs / inside now from
/// `/attendance/summary`), a toolbar of search + branch + sort + quick date
/// chips + status / method chips, and visits grouped under day headings as
/// rich cards. Tapping a card opens the visit-detail sheet, where Edit /
/// Delete appear for `attendance:update` / `attendance:delete` holders (web's
/// row menu) and Check out for `attendance:checkout`.
///
/// **Dropped vs. web**: CSV / Excel export (`attendance:export`) — the app has
/// no file-saving / sharing package, same documented omission as every report
/// screen's "Export". Column sorting by attendance date / created-at (grouping
/// by day needs check-in order).
class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({super.key});

  @override
  State<AttendanceHistoryScreen> createState() =>
      _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  final _items = <AttendanceRecord>[];
  List<BranchOption> _branches = [];
  AttendanceSummary? _glance;

  String _search = '';
  String? _branchId;
  String _status = '';
  String _method = '';
  String _sort = 'checkInTime:desc';
  _Range _preset = _Range.month30;
  DateTimeRange? _custom;

  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  int _total = 0;
  int _totalPages = 1;
  int _req = 0;

  @override
  void initState() {
    super.initState();
    _loadBranches();
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

  DateTimeRange? get _range {
    final now = dayOnly(DateTime.now());
    switch (_preset) {
      case _Range.today:
        return DateTimeRange(start: now, end: now);
      case _Range.week:
        return DateTimeRange(
          start: now.subtract(const Duration(days: 6)),
          end: now,
        );
      case _Range.month30:
        return DateTimeRange(
          start: now.subtract(const Duration(days: 29)),
          end: now,
        );
      case _Range.thisMonth:
        return DateTimeRange(start: DateTime(now.year, now.month), end: now);
      case _Range.all:
        return null;
      case _Range.custom:
        return _custom;
    }
  }

  String get _rangeText {
    final r = _range;
    if (r == null) return 'All time';
    if (_preset == _Range.today) return 'Today';
    return '${fmtDayMonth(r.start)} – ${fmtDayMonth(r.end)}';
  }

  bool get _hasFilters =>
      _search.isNotEmpty ||
      _branchId != null ||
      _status.isNotEmpty ||
      _method.isNotEmpty ||
      _preset != _Range.month30;

  Future<PaginatedResult<AttendanceRecord>> _fetch(int page) async {
    final range = _range;
    final sort = _sort.split(':');
    return getIt<AttendanceRepository>().list(
      page: page,
      search: _search,
      branchId: _branchId,
      status: _status.isEmpty ? null : _status,
      method: _method.isEmpty ? null : _method,
      dateFrom: range?.start,
      dateTo: range?.end,
      sortBy: sort[0],
      sortDir: sort[1],
    );
  }

  Future<void> _load({bool silent = false}) async {
    final req = ++_req;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    // Today's glance follows the branch filter; failure is non-fatal.
    getIt<AttendanceRepository>().summary(branchId: _branchId).then((s) {
      if (mounted && req == _req) setState(() => _glance = s);
    }).catchError((Object _) {});
    try {
      final page = await _fetch(1);
      if (!mounted || req != _req) return;
      setState(() {
        _items
          ..clear()
          ..addAll(page.items);
        _page = page.page;
        _total = page.total;
        _totalPages = page.totalPages;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(req, e.message);
    } catch (e) {
      _fail(req, 'Could not load attendance ($e)');
    }
  }

  void _fail(int req, String message) {
    if (!mounted || req != _req) return;
    if (_items.isNotEmpty) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    final req = _req;
    try {
      final page = await _fetch(_page + 1);
      if (!mounted || req != _req) return;
      setState(() {
        _items.addAll(page.items);
        _page = page.page;
        _totalPages = page.totalPages;
        _total = page.total;
      });
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, attendanceErrorText(e), error: true);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _apply(VoidCallback change) {
    setState(change);
    _load();
  }

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branchId,
      clearLabel: 'All branches',
    );
    if (v == null) return;
    _apply(() => _branchId = v.isEmpty ? null : v);
  }

  Future<void> _pickSort() async {
    final v = await pickOneSheet(
      context,
      title: 'Sort by',
      options: _sorts,
      current: _sort,
    );
    if (v == null || v.isEmpty) return;
    _apply(() => _sort = v);
  }

  Future<void> _pickCustomRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: now,
      initialDateRange: _range,
    );
    if (picked == null) return;
    _apply(() {
      _custom = picked;
      _preset = _Range.custom;
    });
  }

  void _reset() {
    setState(() {
      _search = '';
      _branchId = null;
      _status = '';
      _method = '';
      _preset = _Range.month30;
      _custom = null;
      _resetKey++;
    });
    _load();
  }

  /// Bumped on reset so the search field (which owns its controller) is
  /// rebuilt empty.
  int _resetKey = 0;

  Future<void> _open(AttendanceRecord r) async {
    final changed = await showAttendanceDetailSheet(context, r);
    if (changed && mounted) _load(silent: true);
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final access = AttendanceAccess.of(context);
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top)),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
                  child: _toolbar(),
                ),
              ),
            ),
            ..._body(access),
          ],
        ),
      ),
    );
  }

  List<Widget> _body(AttendanceAccess access) {
    if (_loading && _items.isEmpty) {
      return const [
        SliverFillRemaining(hasScrollBody: false, child: AppLoadingView()),
      ];
    }
    if (_error != null && _items.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppErrorView(message: _error!, onRetry: _load),
        ),
      ];
    }
    if (_items.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppEmptyState(
            icon: Icons.event_busy_rounded,
            title: 'No visits found',
            message: _hasFilters
                ? 'Try a different range or filter.'
                : 'Check-ins will show up here.',
          ),
        ),
      ];
    }
    final groups = groupRecordsByDay(_items);
    return [
      for (final g in groups) ...[
        SliverToBoxAdapter(
          child: TeamCenter(child: _DayHeader(day: g.$1)),
        ),
        teamCardSliver<AttendanceRecord>(
          context,
          items: g.$2,
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 6),
          builder: (r, i) => FadeUp(
            index: i.clamp(0, 6),
            child: AttendanceRecordCard(
              key: ValueKey('visit-${r.id}'),
              record: r,
              showBranch: true,
              onTap: () => _open(r),
            ),
          ),
        ),
      ],
      SliverToBoxAdapter(
        child: TeamCenter(
          maxWidth: 640,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
            child: _page < _totalPages
                ? Center(
                    child: LoadMoreButton(
                      loading: _loadingMore,
                      onPressed: _loadMore,
                      shownCount: _items.length,
                      totalCount: _total,
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: Text(
                        'Showing all $_total ${_total == 1 ? 'visit' : 'visits'}',
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
          ),
        ),
      ),
    ];
  }

  Widget _hero(double top) {
    final g = _glance;
    return ListHero(
      title: 'Attendance History',
      subtitle: _loading && _items.isEmpty
          ? 'Every check-in and check-out'
          : '$_total ${_total == 1 ? 'visit' : 'visits'} · $_rangeText',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        if (_hasFilters)
          ListHeroButton(icon: Icons.filter_alt_off_rounded, onTap: _reset),
      ],
      chips: [
        if (g != null) ...[
          AttendanceLiveChip(label: '${g.currentlyInside} inside now'),
          ListHeroChip(
            icon: Icons.login_rounded,
            label: '${g.totalCheckInsToday} in today',
          ),
          ListHeroChip(
            icon: Icons.logout_rounded,
            label: '${g.totalCheckOutsToday} out today',
          ),
        ],
      ],
    );
  }

  Widget _toolbar() {
    final sortLabel = _sorts.firstWhere((s) => s.$1 == _sort).$2;
    final branchLabel = _branchId == null
        ? 'All branches'
        : _branches
            .firstWhere(
              (b) => b.id == _branchId,
              orElse: () => BranchOption(id: _branchId!, name: 'Branch'),
            )
            .name;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSearchField(
          key: ValueKey('search-$_resetKey'),
          hint: 'Search member name or ID…',
          onSearch: (v) => _apply(() => _search = v),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TeamToolbarButton(
                icon: Icons.storefront_rounded,
                label: branchLabel,
                active: _branchId != null,
                onTap: _pickBranch,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TeamToolbarButton(
                icon: Icons.sort_rounded,
                label: sortLabel,
                onTap: _pickSort,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _chipRow([
          for (final r in _rangeLabels.entries)
            TeamFilterChip(
              label: r.value,
              selected: _preset == r.key,
              color: TeamColors.fuchsia,
              onTap: () => _apply(() => _preset = r.key),
            ),
          TeamFilterChip(
            label: _preset == _Range.custom ? _rangeText : 'Custom…',
            selected: _preset == _Range.custom,
            color: TeamColors.fuchsia,
            onTap: _pickCustomRange,
          ),
        ]),
        const SizedBox(height: 8),
        _chipRow([
          for (final s in _statusOptions)
            TeamFilterChip(
              label: s.label,
              selected: _status == s.value,
              color: s.color,
              onTap: () => _apply(() => _status = s.value),
            ),
        ]),
        const SizedBox(height: 8),
        _chipRow([
          TeamFilterChip(
            label: 'Any method',
            selected: _method.isEmpty,
            color: TeamColors.indigo,
            onTap: () => _apply(() => _method = ''),
          ),
          for (final m in kAttendanceMethods)
            TeamFilterChip(
              label: m.$2,
              selected: _method == m.$1,
              color: attendanceMethodColor(m.$1),
              onTap: () => _apply(() => _method = m.$1),
            ),
        ]),
      ],
    );
  }

  Widget _chipRow(List<Widget> chips) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (var i = 0; i < chips.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              chips[i],
            ],
          ],
        ),
      );
}

/// "Today · 17 Oct" style day separator.
class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.day});

  final DateTime day;

  @override
  Widget build(BuildContext context) {
    final heading = dayHeading(day);
    final isRelative = heading == 'Today' || heading == 'Yesterday';
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              gradient: TeamColors.cta,
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Icon(
              Icons.calendar_today_rounded,
              size: 13,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 9),
          Text(heading, style: AppText.display(size: 15)),
          if (isRelative) ...[
            const SizedBox(width: 8),
            Text(
              fmtDayMonth(day),
              style: AppText.body(
                size: 12,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

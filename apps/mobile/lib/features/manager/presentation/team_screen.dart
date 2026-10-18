import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/staff_member.dart';
import '../../../models/staff_stats.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../team/presentation/staff_actions.dart';
import '../../team/presentation/widgets/team_ui.dart';
import '../../../shared/widgets/list_hero.dart';

const List<({String label, String? value, Color color})> _statusFilters = [
  (label: 'All', value: null, color: TeamColors.indigo),
  (label: 'Active', value: 'ACTIVE', color: TeamColors.green),
  (label: 'Pending', value: 'PENDING_VERIFICATION', color: TeamColors.amber),
  (label: 'Locked', value: 'LOCKED', color: TeamColors.rose),
  (label: 'Suspended', value: 'SUSPENDED', color: TeamColors.sky),
  (label: 'Deactivated', value: 'DEACTIVATED', color: TeamColors.slate),
];

const _workStatuses = [
  ('WORKING', 'Working'),
  ('ON_LEAVE', 'On leave'),
  ('NOTICE_PERIOD', 'Notice period'),
  ('TERMINATED', 'Terminated'),
];

const _sortOptions = [
  (value: 'createdAt', dir: 'desc', label: 'Newest first'),
  (value: 'createdAt', dir: 'asc', label: 'Oldest first'),
  (value: 'name', dir: 'asc', label: 'Name (A-Z)'),
  (value: 'name', dir: 'desc', label: 'Name (Z-A)'),
  (value: 'employeeId', dir: 'asc', label: 'Employee ID (A-Z)'),
  (value: 'joiningDate', dir: 'desc', label: 'Joining date (newest)'),
  (value: 'joiningDate', dir: 'asc', label: 'Joining date (oldest)'),
  (value: 'lastLoginAt', dir: 'desc', label: 'Last sign-in (recent)'),
];

Color roleColor(StaffRole r) => switch (r) {
      StaffRole.manager => TeamColors.teal,
      StaffRole.trainer => TeamColors.violet,
      StaffRole.receptionist => TeamColors.indigo,
    };

IconData roleIcon(StaffRole r) => switch (r) {
      StaffRole.manager => Icons.admin_panel_settings_rounded,
      StaffRole.trainer => Icons.fitness_center_rounded,
      StaffRole.receptionist => Icons.support_agent_rounded,
    };

Color workStatusColor(String? w) => switch (w) {
      'WORKING' => TeamColors.green,
      'ON_LEAVE' => TeamColors.sky,
      'NOTICE_PERIOD' => TeamColors.amber,
      'TERMINATED' => TeamColors.rose,
      _ => TeamColors.slate,
    };

/// Staff roster (`GET /staff`, scoped server-side to the branches the viewer
/// can see) brought to parity with web's `/staff` page: KPI tiles and insight
/// panels that open detail sheets, search + role / work-status / branch /
/// status / sort filters, rich cards with a lifecycle menu, long-press
/// multi-select with bulk activate / deactivate / delete, and Add staff.
///
/// **Dropped vs. web** (documented, not silently skipped):
/// - CSV export / import — desktop file-handling flows; mobile has no
///   file-picker / share-sheet wiring for them (same call as Members' CSV).
/// - Grid / list view toggle — mobile is always one column.
/// - The hero's decorative overlapping-avatar strip.
///
/// [standalone] renders it as a pushed page (back button, own Scaffold) —
/// used from the Team & Access hub so Owners (who have no Team tab) can reach
/// it. As the Manager shell's tab it stays chromeless with the menu button.
class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key, this.standalone = false});

  final bool standalone;

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> {
  String _search = '';
  String? _status;
  StaffRole? _role;
  String? _workStatus;
  String? _branchId;
  String? _branchName;
  String _sortBy = 'createdAt';
  String _sortDir = 'desc';
  final Set<String> _selected = {};
  bool _bulkBusy = false;

  List<BranchOption> _branches = const [];
  StaffStats? _stats;
  String? _statsError;

  late final _cubit = PaginatedListCubit<StaffMember>(
    (page) => getIt<StaffRepository>().list(
      page: page,
      search: _search,
      status: _status,
      role: _role,
      workStatus: _workStatus,
      branchId: _branchId,
      includeDeleted: true,
      sortBy: _sortBy,
      sortDir: _sortDir,
    ),
  );

  bool get _selecting => _selected.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _cubit.load();
    _loadStats();
    _loadBranches();
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  Future<void> _loadBranches() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (mounted) setState(() => _branches = b);
    } catch (_) {
      // Branch filter simply stays hidden.
    }
  }

  Future<void> _loadStats() async {
    try {
      final all = await getIt<StaffRepository>().listAll(branchId: _branchId);
      if (!mounted) return;
      setState(() {
        _stats = StaffStats.from(all);
        _statsError = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _statsError = e.message);
    } catch (e) {
      if (mounted) setState(() => _statsError = '$e');
    }
  }

  Future<void> _refresh() async {
    _selected.clear();
    _cubit.load();
    await _loadStats();
  }

  void _reloadList() {
    setState(_selected.clear);
    _cubit.load();
  }

  void _setStatus(String? s) {
    setState(() => _status = s);
    _reloadList();
  }

  Future<void> _pickRole() async {
    final v = await pickOneSheet(
      context,
      title: 'Filter by role',
      options: [for (final r in StaffRole.values) (r.apiValue, r.label)],
      current: _role?.apiValue,
      clearLabel: 'All roles',
    );
    if (v == null) return;
    setState(() => _role = v.isEmpty ? null : StaffRoleX.fromApi(v));
    _reloadList();
  }

  Future<void> _pickWorkStatus() async {
    final v = await pickOneSheet(
      context,
      title: 'Filter by work status',
      options: _workStatuses,
      current: _workStatus,
      clearLabel: 'All work statuses',
    );
    if (v == null) return;
    setState(() => _workStatus = v.isEmpty ? null : v);
    _reloadList();
  }

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Filter by branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branchId,
      clearLabel: 'All branches',
    );
    if (v == null) return;
    setState(() {
      _branchId = v.isEmpty ? null : v;
      _branchName =
          v.isEmpty ? null : _branches.firstWhere((b) => b.id == v).name;
      _stats = null;
    });
    _reloadList();
    _loadStats();
  }

  Future<void> _pickSort() async {
    final v = await pickOneSheet(
      context,
      title: 'Sort by',
      options: [
        for (final o in _sortOptions) ('${o.value}:${o.dir}', o.label),
      ],
      current: '$_sortBy:$_sortDir',
    );
    if (v == null || v.isEmpty) return;
    final parts = v.split(':');
    setState(() {
      _sortBy = parts[0];
      _sortDir = parts[1];
    });
    _reloadList();
  }

  void _toggleSelect(StaffMember s) {
    setState(() {
      if (!_selected.add(s.id)) _selected.remove(s.id);
    });
  }

  Future<void> _bulk(String action) async {
    final ids = _selected.toList();
    setState(() => _bulkBusy = true);
    final done = await runBulkStaffAction(context, action, ids);
    if (!mounted) return;
    setState(() => _bulkBusy = false);
    if (done) await _refresh();
  }

  Future<void> _openDetail(StaffMember s) =>
      context.push(AppRoutes.staffDetail, extra: s.id).then((_) => _refresh());

  Future<void> _add() =>
      context.push(AppRoutes.staffForm).then((_) => _refresh());

  void _openStaffSheet(
    String title,
    IconData icon,
    Color color,
    List<StaffMember> people, {
    String? filterStatus,
  }) {
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: icon,
        title: title,
        subtitle:
            '${people.length} ${people.length == 1 ? 'person' : 'people'}',
        color: color,
        child: _PeopleList(
          people: people,
          color: color,
          emptyLabel: 'Nobody here right now.',
          filterStatus: filterStatus,
          onFilter: filterStatus == null
              ? null
              : () {
                  Navigator.of(sheetContext).pop();
                  _setStatus(filterStatus.isEmpty ? null : filterStatus);
                },
          onOpen: (s) {
            Navigator.of(sheetContext).pop();
            _openDetail(s);
          },
        ),
      ),
    );
  }

  void _openGroupedSheet(
    String title,
    IconData icon,
    Color color,
    List<(String, Color, List<StaffMember>)> groups,
  ) {
    final total = groups.fold(0, (a, g) => a + g.$3.length);
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: icon,
        title: title,
        subtitle: '$total ${total == 1 ? 'person' : 'people'}',
        color: color,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final g in groups)
              if (g.$3.isNotEmpty) ...[
                TeamGroupLabel('${g.$1} · ${g.$3.length}', color: g.$2),
                for (final s in g.$3)
                  TeamPersonRow(
                    name: s.name,
                    detail:
                        '${s.role.label} · ${s.primaryBranch?.branchName ?? 'No branch'}',
                    color: g.$2,
                    avatarUrl: s.avatarUrl,
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      _openDetail(s);
                    },
                  ),
                const SizedBox(height: 6),
              ],
            if (total == 0)
              Text(
                'Nobody here right now.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
          ],
        ),
      ),
    );
  }

  // ── KPI tiles ─────────────────────────────────────────────────────────────

  List<TeamKpi> _kpis() {
    final s = _stats;
    return [
      TeamKpi(
        label: 'Total staff',
        value: s?.total ?? 0,
        color: TeamColors.indigo,
        icon: Icons.groups_rounded,
        active: _status == null,
      ),
      TeamKpi(
        label: 'Active',
        value: s?.count('ACTIVE') ?? 0,
        color: TeamColors.green,
        icon: Icons.verified_user_rounded,
        active: _status == 'ACTIVE',
      ),
      TeamKpi(
        label: 'Pending verification',
        value: s?.count('PENDING_VERIFICATION') ?? 0,
        color: TeamColors.amber,
        icon: Icons.mark_email_unread_rounded,
        active: _status == 'PENDING_VERIFICATION',
      ),
      TeamKpi(
        label: 'Locked or suspended',
        value: s?.lockedOrSuspended.length ?? 0,
        color: TeamColors.rose,
        icon: Icons.lock_rounded,
      ),
      TeamKpi(
        label: 'On leave',
        value: s?.workCount('ON_LEAVE') ?? 0,
        color: TeamColors.sky,
        icon: Icons.beach_access_rounded,
      ),
      TeamKpi(
        label: 'Notice period',
        value: s?.workCount('NOTICE_PERIOD') ?? 0,
        color: TeamColors.violet,
        icon: Icons.hourglass_bottom_rounded,
      ),
    ];
  }

  void _onKpi(int i) {
    final s = _stats;
    if (s == null) return;
    switch (i) {
      case 0:
        _openStaffSheet(
          'Total staff',
          Icons.groups_rounded,
          TeamColors.indigo,
          s.everyone,
          filterStatus: '',
        );
      case 1:
        _openStaffSheet(
          'Active',
          Icons.verified_user_rounded,
          TeamColors.green,
          s.byStatus['ACTIVE'] ?? const [],
          filterStatus: 'ACTIVE',
        );
      case 2:
        _openStaffSheet(
          'Pending verification',
          Icons.mark_email_unread_rounded,
          TeamColors.amber,
          s.pendingNewestFirst,
          filterStatus: 'PENDING_VERIFICATION',
        );
      case 3:
        _openGroupedSheet(
          'Locked or suspended',
          Icons.lock_rounded,
          TeamColors.rose,
          [
            ('Locked', TeamColors.rose, s.byStatus['LOCKED'] ?? const []),
            ('Suspended', TeamColors.sky, s.byStatus['SUSPENDED'] ?? const []),
          ],
        );
      case 4:
        _openStaffSheet(
          'On leave',
          Icons.beach_access_rounded,
          TeamColors.sky,
          s.byWorkStatus['ON_LEAVE'] ?? const [],
        );
      default:
        _openStaffSheet(
          'Notice period',
          Icons.hourglass_bottom_rounded,
          TeamColors.violet,
          s.byWorkStatus['NOTICE_PERIOD'] ?? const [],
        );
    }
  }

  // ── insight panels ────────────────────────────────────────────────────────

  Widget _insights(StaffStats s) {
    final statusSlices = [
      for (final st in StaffStats.statusOrder)
        if (s.count(st) > 0)
          DonutSlice(
            label: statusLabel(st),
            value: s.count(st),
            color: statusColor(st),
          ),
    ];
    final locked = s.byStatus['LOCKED'] ?? const <StaffMember>[];
    final pending = s.pendingNewestFirst;
    final roleRows = [
      for (final r in StaffRole.values) (r.label, s.roleCount(r)),
    ];
    final workRows = [
      for (final w in StaffStats.workStatusOrder)
        (prettyEnum(w), s.workCount(w)),
    ];
    final attention = locked.length + pending.length;
    return TeamAdaptive(
      children: [
        TeamInsightCard(
          icon: Icons.donut_large_rounded,
          title: 'Status mix',
          color: TeamColors.indigo,
          trailing: '${s.live.length} staff',
          onTap: () => _openGroupedSheet(
            'Status mix',
            Icons.donut_large_rounded,
            TeamColors.indigo,
            [
              for (final st in StaffStats.statusOrder)
                (statusLabel(st), statusColor(st), s.byStatus[st] ?? const []),
            ],
          ),
          child: statusSlices.isEmpty
              ? Text(
                  'No staff yet.',
                  style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                )
              : DonutChart(slices: statusSlices, size: 84),
        ),
        TeamInsightCard(
          icon: Icons.key_rounded,
          title: 'People by role',
          color: TeamColors.violet,
          onTap: () => _openGroupedSheet(
            'People by role',
            Icons.key_rounded,
            TeamColors.violet,
            [
              for (final r in StaffRole.values)
                (r.label, roleColor(r), s.byRole[r] ?? const []),
            ],
          ),
          child: TeamBarRows(
            rows: roleRows,
            colors: [for (final r in StaffRole.values) roleColor(r)],
          ),
        ),
        TeamInsightCard(
          icon: Icons.schedule_rounded,
          title: 'Work status',
          color: TeamColors.teal,
          onTap: () => _openGroupedSheet(
            'Work status',
            Icons.schedule_rounded,
            TeamColors.teal,
            [
              for (final w in StaffStats.workStatusOrder)
                (
                  prettyEnum(w),
                  workStatusColor(w),
                  s.byWorkStatus[w] ?? const []
                ),
            ],
          ),
          child: TeamBarRows(
            rows: workRows,
            colors: [
              for (final w in StaffStats.workStatusOrder) workStatusColor(w),
            ],
          ),
        ),
        TeamInsightCard(
          icon: Icons.notification_important_rounded,
          title: 'Needs attention',
          color: TeamColors.rose,
          trailing: attention == 0 ? null : '$attention',
          onTap: () => _openGroupedSheet(
            'Needs attention',
            Icons.notification_important_rounded,
            TeamColors.rose,
            [
              ('Locked account', TeamColors.rose, locked),
              ('Invited, not verified', TeamColors.amber, pending),
            ],
          ),
          child: attention == 0
              ? Row(
                  children: [
                    const Icon(
                      Icons.check_circle_rounded,
                      size: 18,
                      color: TeamColors.green,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Nobody needs attention right now.',
                        style: AppText.body(
                          size: 12.5,
                          color: AppColors.inkSoft,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (locked.isNotEmpty) ...[
                      const TeamGroupLabel('Locked account'),
                      for (final p in locked.take(3))
                        TeamPersonRow(
                          name: p.name,
                          detail: 'Too many failed sign-ins',
                          color: TeamColors.rose,
                          avatarUrl: p.avatarUrl,
                          onTap: () => _openDetail(p),
                        ),
                    ],
                    if (pending.isNotEmpty) ...[
                      const TeamGroupLabel('Invited, not verified'),
                      for (final p in pending.take(3))
                        TeamPersonRow(
                          name: p.name,
                          detail: _invitedLabel(p),
                          color: TeamColors.amber,
                          avatarUrl: p.avatarUrl,
                          onTap: () => _openDetail(p),
                        ),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  String _invitedLabel(StaffMember s) {
    final d = DateTime.now()
        .difference(s.createdAt ?? s.joiningDate)
        .inDays
        .clamp(0, 100000);
    return d == 0 ? 'Invited today' : 'Invited $d day${d == 1 ? '' : 's'} ago';
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final body = BlocProvider<PaginatedListCubit<StaffMember>>.value(
      value: _cubit,
      child: Stack(
        fit: StackFit.expand,
        children: [
          RefreshIndicator(
            color: AppColors.staffB,
            backgroundColor: AppColors.surface2,
            onRefresh: _refresh,
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _hero()),
                SliverToBoxAdapter(child: TeamCenter(child: _header())),
                BlocBuilder<PaginatedListCubit<StaffMember>,
                    PaginatedListState<StaffMember>>(
                  builder: (context, state) => switch (state) {
                    PaginatedListLoading() => const SliverFillRemaining(
                        hasScrollBody: false,
                        child: AppLoadingView(),
                      ),
                    PaginatedListError(:final message) => SliverFillRemaining(
                        hasScrollBody: false,
                        child: AppErrorView(
                          message: message,
                          onRetry: _cubit.load,
                        ),
                      ),
                    PaginatedListLoaded(:final items) when items.isEmpty =>
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: AppEmptyState(
                          icon: Icons.groups_outlined,
                          title: _hasFilters
                              ? 'No staff match these filters'
                              : 'No staff yet',
                          message: _hasFilters
                              ? 'Try clearing a filter or the search.'
                              : 'Tap + to add a Manager, Trainer or '
                                  'Receptionist.',
                        ),
                      ),
                    PaginatedListLoaded(
                      :final items,
                      :final hasMore,
                      :final loadingMore,
                    ) =>
                      teamCardSliver<StaffMember>(
                        context,
                        items: items,
                        padding: EdgeInsets.fromLTRB(
                          18,
                          0,
                          18,
                          widget.standalone ? 90 : 96,
                        ),
                        footer: hasMore
                            ? Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Center(
                                  child: loadingMore
                                      ? const CircularProgressIndicator()
                                      : TextButton(
                                          onPressed: _cubit.loadMore,
                                          child: const Text('Load more'),
                                        ),
                                ),
                              )
                            : null,
                        builder: (s, i) => _FadeUpCard(
                          index: i,
                          child: _StaffCard(
                            staff: s,
                            selecting: _selecting,
                            selected: _selected.contains(s.id),
                            onTap: () =>
                                _selecting ? _toggleSelect(s) : _openDetail(s),
                            onLongPress: () => _toggleSelect(s),
                            onChanged: _refresh,
                          ),
                        ),
                      ),
                  },
                ),
              ],
            ),
          ),
          if (_selecting)
            Positioned(
              left: 0,
              right: 0,
              bottom: widget.standalone ? 16 : 94,
              child: TeamCenter(
                maxWidth: 640,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _SelectionBar(
                    count: _selected.length,
                    busy: _bulkBusy,
                    canActivate: teamCan(context, 'staff:activate'),
                    canDelete: teamCan(context, 'staff:delete'),
                    onClear: () => setState(_selected.clear),
                    onAction: _bulk,
                  ),
                ),
              ),
            ),
        ],
      ),
    );

    if (!widget.standalone) return body;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: body,
    );
  }

  bool get _hasFilters =>
      _search.isNotEmpty ||
      _status != null ||
      _role != null ||
      _workStatus != null ||
      _branchId != null;

  Widget _hero() {
    final canCreate = teamCan(context, 'staff:create');
    final s = _stats;
    return ListHero(
      title: widget.standalone ? 'Staff directory' : 'Team',
      subtitle: s == null
          ? null
          : '${s.live.length} staff'
              '${s.deleted > 0 ? ' · ${s.deleted} deleted' : ''}',
      topInset: widget.standalone ? MediaQuery.of(context).padding.top : 0,
      side: 18 + teamSideInset(context),
      leading: widget.standalone
          ? ListHeroButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => context.pop(),
            )
          : ListHeroButton(
              icon: Icons.menu_rounded,
              onTap: () => SlideDrawerController.of(context)?.open(),
            ),
      trailing: [
        if (canCreate) ListHeroButton(icon: Icons.add_rounded, onTap: _add),
      ],
      chips: [
        if (s != null) ...[
          ListHeroChip(
            icon: Icons.verified_user_rounded,
            label: '${s.count('ACTIVE')} active',
          ),
          ListHeroChip(
            icon: Icons.mark_email_unread_rounded,
            label: '${s.count('PENDING_VERIFICATION')} pending',
          ),
          ListHeroChip(icon: Icons.groups_rounded, label: '${s.total} total'),
        ],
      ],
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TeamKpiGrid(
            tiles: _kpis(),
            loading: _stats == null && _statsError == null,
            onTap: _stats == null ? null : _onKpi,
          ),
          const SizedBox(height: 14),
          if (_statsError != null)
            AppErrorView(message: _statsError!, onRetry: _loadStats)
          else if (_stats != null)
            _insights(_stats!),
          const SizedBox(height: 14),
          TeamSearchField(
            hint: 'Search name, email, phone, employee ID…',
            onSearch: (v) {
              _search = v;
              _reloadList();
            },
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.badge_outlined,
                  label: _role?.label ?? 'All roles',
                  active: _role != null,
                  onTap: _pickRole,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.schedule_rounded,
                  label: _workStatus == null
                      ? 'All work statuses'
                      : prettyEnum(_workStatus),
                  active: _workStatus != null,
                  onTap: _pickWorkStatus,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (_branches.length > 1) ...[
                Expanded(
                  child: TeamToolbarButton(
                    icon: Icons.place_outlined,
                    label: _branchName ?? 'All branches',
                    active: _branchId != null,
                    onTap: _pickBranch,
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.sort_rounded,
                  label: _sortOptions
                      .firstWhere(
                        (o) => o.value == _sortBy && o.dir == _sortDir,
                      )
                      .label,
                  onTap: _pickSort,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final f in _statusFilters) ...[
                  TeamFilterChip(
                    label: f.label,
                    color: f.color,
                    selected: _status == f.value,
                    onTap: () => _setStatus(f.value),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Thin wrapper so list cards fade up without pulling `FadeUp`'s long delay
/// ramp for rows far down the list.
class _FadeUpCard extends StatelessWidget {
  const _FadeUpCard({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 380 + (index.clamp(0, 6)) * 60),
      curve: Curves.easeOutCubic,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - t)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

// ── people list used inside the KPI sheets ──────────────────────────────────

class _PeopleList extends StatelessWidget {
  const _PeopleList({
    required this.people,
    required this.color,
    required this.emptyLabel,
    required this.onOpen,
    this.filterStatus,
    this.onFilter,
  });

  final List<StaffMember> people;
  final Color color;
  final String emptyLabel;
  final String? filterStatus;
  final VoidCallback? onFilter;
  final ValueChanged<StaffMember> onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (onFilter != null) ...[
          GestureDetector(
            onTap: onFilter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 11),
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: color.withValues(alpha: 0.4)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.filter_alt_rounded, size: 16, color: color),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      filterStatus == null || filterStatus!.isEmpty
                          ? 'Show everyone in the main list'
                          : 'Filter the main list',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w800,
                        color: color,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        if (people.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              emptyLabel,
              style: AppText.body(size: 13, color: AppColors.inkFaint),
            ),
          )
        else
          for (final s in people)
            TeamPersonRow(
              name: s.name,
              detail:
                  '${s.role.label} · ${s.employeeId} · ${s.primaryBranch?.branchName ?? 'No branch'}',
              color: statusColor(s.status, deleted: s.isDeleted),
              avatarUrl: s.avatarUrl,
              onTap: () => onOpen(s),
            ),
      ],
    );
  }
}

// ── selection bar ───────────────────────────────────────────────────────────

class _SelectionBar extends StatelessWidget {
  const _SelectionBar({
    required this.count,
    required this.busy,
    required this.canActivate,
    required this.canDelete,
    required this.onClear,
    required this.onAction,
  });

  final int count;
  final bool busy;
  final bool canActivate;
  final bool canDelete;
  final VoidCallback onClear;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    Widget btn(String label, IconData icon, Color color, String action) =>
        Expanded(
          child: GestureDetector(
            onTap: busy ? null : () => onAction(action),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 15, color: color),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: color,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );

    return Material(
      color: Colors.transparent,
      elevation: 10,
      shadowColor: Colors.black54,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 6, 10),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: TeamColors.violet.withValues(alpha: 0.5)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '$count selected',
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Clear selection',
                  icon: const Icon(Icons.close_rounded, size: 18),
                  onPressed: onClear,
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: busy
                  ? const Center(
                      heightFactor: 1.6,
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : Row(
                      children: [
                        if (canActivate) ...[
                          btn(
                            'Activate',
                            Icons.play_arrow_rounded,
                            TeamColors.green,
                            'activate',
                          ),
                          const SizedBox(width: 6),
                          btn(
                            'Deactivate',
                            Icons.block_rounded,
                            TeamColors.slate,
                            'deactivate',
                          ),
                          const SizedBox(width: 6),
                        ],
                        if (canDelete)
                          btn(
                            'Delete',
                            Icons.delete_outline_rounded,
                            TeamColors.rose,
                            'delete',
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── staff card ──────────────────────────────────────────────────────────────

class _StaffCard extends StatelessWidget {
  const _StaffCard({
    required this.staff,
    required this.selecting,
    required this.selected,
    required this.onTap,
    required this.onLongPress,
    required this.onChanged,
  });

  final StaffMember staff;
  final bool selecting;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final Future<void> Function() onChanged;

  Future<void> _open(BuildContext context, Uri uri) async {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) teamSnack(context, 'Could not open that app.');
  }

  Future<void> _menu(BuildContext context, String value) async {
    final s = staff;
    switch (value) {
      case 'view':
        onTap();
        return;
      case 'manual':
        if (await runManualActivate(context, s)) await onChanged();
      case 'resend':
        await runResendActivation(context, s);
      default:
        final action = StaffAction.values.firstWhere((a) => a.name == value);
        if (await runStaffAction(context, s, action)) await onChanged();
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = staff;
    final tone = statusColor(s.status, deleted: s.isDeleted);
    final canActivate = teamCan(context, 'staff:activate');
    final canInvite = teamCan(context, 'staff:invite');
    final canRestore = teamCan(context, 'staff:restore');
    final canDelete = teamCan(context, 'staff:delete');
    final hasPhone = s.phone != null && s.phone!.isNotEmpty;

    final items = <PopupMenuEntry<String>>[
      const PopupMenuItem(value: 'view', child: Text('View profile')),
      if (s.isDeleted) ...[
        if (canRestore)
          const PopupMenuItem(value: 'restore', child: Text('Restore')),
      ] else if (s.isInactive) ...[
        if (canActivate)
          const PopupMenuItem(value: 'activate', child: Text('Activate')),
      ] else if (s.status == 'PENDING_VERIFICATION') ...[
        if (canActivate)
          const PopupMenuItem(
            value: 'manual',
            child: Text('Manually activate'),
          ),
        if (canInvite)
          const PopupMenuItem(
            value: 'resend',
            child: Text('Resend activation email'),
          ),
      ] else if (canActivate) ...[
        const PopupMenuItem(value: 'suspend', child: Text('Suspend')),
        const PopupMenuItem(value: 'deactivate', child: Text('Deactivate')),
      ],
      if (!s.isDeleted && canDelete)
        const PopupMenuItem(
          value: 'delete',
          child: Text('Delete', style: TextStyle(color: AppColors.danger)),
        ),
    ];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: selected ? TeamColors.violet : AppColors.line,
          width: selected ? 2 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status band
              Container(
                padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      tone.withValues(alpha: 0.30),
                      tone.withValues(alpha: 0.04),
                    ],
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      statusIcon(s.status, deleted: s.isDeleted),
                      size: 14,
                      color: tone,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      statusLabel(s.status, deleted: s.isDeleted),
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: tone,
                      ),
                    ),
                    const Spacer(),
                    if (selecting)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Icon(
                          selected
                              ? Icons.check_circle_rounded
                              : Icons.radio_button_unchecked_rounded,
                          size: 22,
                          color:
                              selected ? TeamColors.violet : AppColors.inkFaint,
                        ),
                      )
                    else if (items.length > 1)
                      PopupMenuButton<String>(
                        padding: EdgeInsets.zero,
                        tooltip: 'Actions for ${s.name}',
                        color: AppColors.surface2,
                        icon: Icon(
                          Icons.more_horiz_rounded,
                          size: 20,
                          color: AppColors.inkSoft,
                        ),
                        onSelected: (v) => _menu(context, v),
                        itemBuilder: (_) => items,
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(2.5),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: SweepGradient(
                              colors: [
                                tone,
                                TeamColors.fuchsia,
                                TeamColors.indigo,
                                tone,
                              ],
                            ),
                          ),
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.surface2,
                            ),
                            child: UserAvatar(
                              avatarUrl: s.avatarUrl,
                              name: s.name,
                              size: 52,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                s.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 15.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                '${s.employeeId} · ${s.email}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 11.5,
                                  weight: FontWeight.w600,
                                  color: AppColors.inkFaint,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  TeamTag(
                                    label: s.role.label,
                                    color: roleColor(s.role),
                                    icon: roleIcon(s.role),
                                  ),
                                  if (s.workStatus != null)
                                    TeamTag(
                                      label: prettyEnum(s.workStatus),
                                      color: workStatusColor(s.workStatus),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: AppColors.surface3.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              _Info(
                                icon: Icons.place_rounded,
                                label: 'Branch',
                                value:
                                    s.primaryBranch?.branchName ?? 'No branch',
                                color: TeamColors.amber,
                              ),
                              _Info(
                                icon: Icons.event_rounded,
                                label: 'Joined',
                                value: fmtDate(s.joiningDate),
                                color: TeamColors.sky,
                              ),
                            ],
                          ),
                          const SizedBox(height: 9),
                          Row(
                            children: [
                              _Info(
                                icon: Icons.account_tree_rounded,
                                label: 'Branches',
                                value: s.branches.isEmpty
                                    ? '—'
                                    : '${s.branches.length}',
                                color: TeamColors.teal,
                              ),
                              _Info(
                                icon: Icons.login_rounded,
                                label: 'Last sign-in',
                                value: s.lastLoginAt == null
                                    ? (s.status == 'PENDING_VERIFICATION'
                                        ? 'Not activated'
                                        : 'Never')
                                    : relativeAgo(s.lastLoginAt),
                                color: TeamColors.violet,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        TeamQuickAction(
                          icon: Icons.mail_rounded,
                          label: 'Email',
                          color: TeamColors.indigo,
                          onTap: s.email.isEmpty
                              ? null
                              : () => _open(
                                    context,
                                    Uri(scheme: 'mailto', path: s.email),
                                  ),
                        ),
                        TeamQuickAction(
                          icon: Icons.call_rounded,
                          label: 'Call',
                          color: TeamColors.green,
                          onTap: hasPhone
                              ? () => _open(
                                    context,
                                    Uri(scheme: 'tel', path: s.phone),
                                  )
                              : null,
                        ),
                        TeamQuickAction(
                          icon: Icons.chat_rounded,
                          label: 'WhatsApp',
                          color: TeamColors.teal,
                          onTap: hasPhone
                              ? () => _open(
                                    context,
                                    Uri.parse('https://wa.me/${_wa(s.phone!)}'),
                                  )
                              : null,
                        ),
                        Expanded(
                          flex: 2,
                          child: Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: GestureDetector(
                              onTap: onTap,
                              child: Container(
                                height: 40,
                                decoration: BoxDecoration(
                                  gradient: TeamColors.cta,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Flexible(
                                      child: Text(
                                        'View profile',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppText.body(
                                          size: 13,
                                          weight: FontWeight.w800,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(
                                      Icons.arrow_forward_rounded,
                                      size: 15,
                                      color: Colors.white,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _wa(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    return digits.length == 10 ? '91$digits' : digits;
  }
}

class _Info extends StatelessWidget {
  const _Info({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 13, color: color),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppText.body(size: 10, color: AppColors.inkFaint),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12.5, weight: FontWeight.w800),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/iam_user.dart';
import '../../../models/iam_user_stats.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../team/presentation/widgets/team_ui.dart';

const _statusOrder = [
  'ACTIVE',
  'PENDING_VERIFICATION',
  'LOCKED',
  'SUSPENDED',
  'DEACTIVATED',
];

const List<({String label, String? value, Color color})> _statusChips = [
  (label: 'All', value: null, color: TeamColors.indigo),
  (label: 'Active', value: 'ACTIVE', color: TeamColors.green),
  (label: 'Pending', value: 'PENDING_VERIFICATION', color: TeamColors.amber),
  (label: 'Locked', value: 'LOCKED', color: TeamColors.rose),
  (label: 'Suspended', value: 'SUSPENDED', color: TeamColors.sky),
  (label: 'Deactivated', value: 'DEACTIVATED', color: TeamColors.slate),
];

/// Web's `/users` page ("Staff & Access"): KPI tiles and insight panels from
/// `GET /users/stats` (each opens a detail sheet), search + role / branch /
/// status filters, and rich user cards with suspend / deactivate / restore /
/// delete (`users:manage`, never on yourself).
///
/// **Dropped vs. web**: CSV export / import (desktop file flows, same call as
/// Members / Staff) and the grid / list view toggle (mobile is one column).
class UsersTab extends StatefulWidget {
  const UsersTab({
    super.key,
    required this.roles,
    required this.onOpenInvites,
    required this.onOpenStaff,
  });

  final List<TenantRole> roles;
  final VoidCallback? onOpenInvites;
  final VoidCallback? onOpenStaff;

  @override
  State<UsersTab> createState() => UsersTabState();
}

class UsersTabState extends State<UsersTab> {
  String _search = '';
  String? _status;
  String? _roleId;
  String? _roleName;
  String? _branchId;
  String? _branchName;
  List<BranchOption> _branches = const [];
  IamUserStats? _stats;
  String? _statsError;
  String? _busyId;

  late final _cubit = PaginatedListCubit<IamUser>(
    (page) => getIt<IamUserRepository>().list(
      page: page,
      search: _search,
      status: _status,
      roleId: _roleId,
      branchId: _branchId,
      includeDeleted: true,
    ),
  );

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

  /// Called by the hub after a user is created.
  Future<void> reload() async {
    _cubit.load();
    await _loadStats();
  }

  Future<void> _loadBranches() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (mounted) setState(() => _branches = b);
    } catch (_) {
      // The branch filter just stays hidden.
    }
  }

  Future<void> _loadStats() async {
    try {
      final s = await getIt<IamUserRepository>().stats(branchId: _branchId);
      if (!mounted) return;
      setState(() {
        _stats = s;
        _statsError = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _statsError = e.message);
    } catch (e) {
      if (mounted) setState(() => _statsError = '$e');
    }
  }

  void _setStatus(String? s) {
    setState(() => _status = s);
    _cubit.load();
  }

  void _setRole(String? id, String? name) {
    setState(() {
      _roleId = id;
      _roleName = name;
    });
    _cubit.load();
  }

  Future<void> _pickRole() async {
    final v = await pickOneSheet(
      context,
      title: 'Filter by role',
      options: [
        for (final r in widget.roles) (r.id, displayRoleName(r.name)),
      ],
      current: _roleId,
      clearLabel: 'All roles',
    );
    if (v == null) return;
    if (v.isEmpty) {
      _setRole(null, null);
    } else {
      _setRole(
        v,
        displayRoleName(widget.roles.firstWhere((r) => r.id == v).name),
      );
    }
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
    _cubit.load();
    _loadStats();
  }

  Future<void> _open(String id) =>
      context.push(AppRoutes.userDetail, extra: id).then((_) => reload());

  Future<void> _act(IamUser u, String action) async {
    final verb = switch (action) {
      'suspend' => 'Suspend',
      'deactivate' => 'Deactivate',
      'restore' => 'Restore',
      _ => 'Delete',
    };
    final ok = await confirmTeam(
      context,
      title: '$verb ${u.name}?',
      message: action == 'delete'
          ? 'This soft-deletes the account. It can be restored later.'
          : 'This action can be reversed later if needed.',
      confirmLabel: verb,
      destructive: action == 'delete' || action == 'suspend',
    );
    if (!ok || !mounted) return;
    setState(() => _busyId = u.id);
    final repo = getIt<IamUserRepository>();
    try {
      switch (action) {
        case 'suspend':
          await repo.suspend(u.id);
        case 'deactivate':
          await repo.deactivate(u.id);
        case 'restore':
          await repo.restore(u.id);
        default:
          await repo.delete(u.id);
      }
      if (!mounted) return;
      teamSnack(
        context,
        '${u.name}: ${switch (action) {
          'suspend' => 'suspended',
          'deactivate' => 'deactivated',
          'restore' => 'restored',
          _ => 'deleted (soft)',
        }}',
      );
      await reload();
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  // ── KPI + insight sheets ──────────────────────────────────────────────────

  List<TeamKpi> _kpis() {
    final s = _stats;
    return [
      TeamKpi(
        label: 'Total people',
        value: s?.total ?? 0,
        color: TeamColors.indigo,
        icon: Icons.groups_rounded,
        active: _status == null,
      ),
      TeamKpi(
        label: 'Active',
        value: s?.status('ACTIVE') ?? 0,
        color: TeamColors.green,
        icon: Icons.verified_user_rounded,
        active: _status == 'ACTIVE',
      ),
      TeamKpi(
        label: 'Pending verification',
        value: s?.status('PENDING_VERIFICATION') ?? 0,
        color: TeamColors.amber,
        icon: Icons.mark_email_unread_rounded,
        active: _status == 'PENDING_VERIFICATION',
      ),
      TeamKpi(
        label: 'Locked or suspended',
        value: (s?.status('LOCKED') ?? 0) + (s?.status('SUSPENDED') ?? 0),
        color: TeamColors.rose,
        icon: Icons.lock_rounded,
      ),
      TeamKpi(
        label: 'Two-factor on',
        value: s?.mfaEnabled ?? 0,
        color: TeamColors.violet,
        icon: Icons.shield_moon_rounded,
      ),
      TeamKpi(
        label: 'Signed in this week',
        value: s?.signedInThisWeek ?? 0,
        color: TeamColors.sky,
        icon: Icons.login_rounded,
      ),
      TeamKpi(
        label: 'Pending invites',
        value: s?.pendingInvitations ?? 0,
        color: TeamColors.fuchsia,
        icon: Icons.forward_to_inbox_rounded,
      ),
      TeamKpi(
        label: 'Never signed in',
        value: s?.signIn('never') ?? 0,
        color: TeamColors.slate,
        icon: Icons.person_off_rounded,
      ),
    ];
  }

  void _onKpi(int i) {
    final s = _stats;
    if (s == null) return;
    final k = _kpis()[i];
    switch (i) {
      case 0:
      case 1:
      case 2:
        final status =
            i == 0 ? null : (i == 1 ? 'ACTIVE' : 'PENDING_VERIFICATION');
        _statSheet(
          k,
          caption: i == 0
              ? 'Everyone with access to this gym, any status.'
              : i == 1
                  ? 'Accounts that can sign in right now.'
                  : 'Invited or created, but the email is not verified yet.',
          people: i == 2 ? s.pendingVerification : const [],
          peopleLabel: 'Invited, not verified',
          filterLabel: i == 0 ? 'Show everyone' : 'Filter the list',
          onFilter: () => _setStatus(status),
        );
      case 3:
        _statSheet(
          k,
          caption: 'Locked after failed sign-ins, or suspended by an admin.',
          people: s.locked,
          peopleLabel: 'Locked account',
          filterLabel: 'Filter locked',
          onFilter: () => _setStatus('LOCKED'),
          secondaryFilterLabel: 'Filter suspended',
          onSecondaryFilter: () => _setStatus('SUSPENDED'),
        );
      case 4:
        _statSheet(
          k,
          caption: '${s.mfaEnabled} of ${s.total} people have two-factor '
              'authentication switched on. Which roles must use it is set in '
              'Settings → Security.',
          ring: s.total == 0 ? 0 : s.mfaEnabled / s.total,
        );
      case 5:
      case 7:
        _statSheet(
          k,
          caption: 'When people last signed in.',
          extra: _signInBars(s),
        );
      default:
        _statSheet(
          k,
          caption: 'Invitations sent that nobody has accepted yet.',
          filterLabel: 'View invitations',
          onFilter: widget.onOpenInvites,
        );
    }
  }

  Widget _signInBars(IamUserStats s) => TeamBarRows(
        rows: [
          ('Today', s.signIn('today')),
          ('This week', s.signIn('thisWeek')),
          ('This month', s.signIn('thisMonth')),
          ('Over a month ago', s.signIn('older')),
          ('Never', s.signIn('never')),
        ],
        colors: const [
          TeamColors.green,
          TeamColors.sky,
          TeamColors.indigo,
          TeamColors.amber,
          TeamColors.rose,
        ],
      );

  void _statSheet(
    TeamKpi k, {
    required String caption,
    List<UserStatsPerson> people = const [],
    String peopleLabel = '',
    String? filterLabel,
    VoidCallback? onFilter,
    String? secondaryFilterLabel,
    VoidCallback? onSecondaryFilter,
    double? ring,
    Widget? extra,
  }) {
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: k.icon,
        title: k.label,
        color: k.color,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (ring != null) ...[
                  AnimatedRing(
                    value: ring,
                    size: 84,
                    stroke: 10,
                    colors: [
                      k.color,
                      Color.lerp(k.color, TeamColors.fuchsia, 0.5)!,
                    ],
                    track: k.color.withValues(alpha: 0.16),
                    child: Text(
                      '${(ring * 100).round()}%',
                      style: AppText.display(size: 16),
                    ),
                  ),
                  const SizedBox(width: 16),
                ],
                CountUp(
                  value: k.value,
                  style: AppText.display(size: 38, color: k.color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    caption,
                    style: AppText.body(
                      size: 12.5,
                      color: AppColors.inkSoft,
                      weight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            if (extra != null) ...[const SizedBox(height: 16), extra],
            if (people.isNotEmpty) ...[
              const SizedBox(height: 14),
              TeamGroupLabel(peopleLabel, color: k.color),
              for (final p in people)
                TeamPersonRow(
                  name: p.name,
                  detail: p.detail,
                  color: k.color,
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _open(p.id);
                  },
                ),
            ],
            if (onFilter != null && filterLabel != null) ...[
              const SizedBox(height: 14),
              _SheetButton(
                label: filterLabel,
                color: k.color,
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  onFilter();
                },
              ),
            ],
            if (onSecondaryFilter != null && secondaryFilterLabel != null) ...[
              const SizedBox(height: 8),
              _SheetButton(
                label: secondaryFilterLabel,
                color: TeamColors.sky,
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  onSecondaryFilter();
                },
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _insights(IamUserStats s) {
    final slices = [
      for (final st in _statusOrder)
        if (s.status(st) > 0)
          DonutSlice(
            label: statusLabel(st),
            value: s.status(st),
            color: statusColor(st),
          ),
    ];
    final roleRows = [
      for (final r in s.byRole) (displayRoleName(r.name), r.count),
    ];
    final attention =
        s.locked.length + s.pendingVerification.length + s.dormant.length;

    Widget group(String label, Color color, List<UserStatsPerson> people) {
      if (people.isEmpty) return const SizedBox.shrink();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TeamGroupLabel(label),
          for (final p in people)
            TeamPersonRow(
              name: p.name,
              detail: p.detail,
              color: color,
              onTap: () => _open(p.id),
            ),
        ],
      );
    }

    return TeamAdaptive(
      children: [
        TeamInsightCard(
          icon: Icons.donut_large_rounded,
          title: 'Status mix',
          color: TeamColors.indigo,
          trailing: '${s.total} people',
          onTap: () => showTeamSheet<void>(
            context,
            (sheetContext) => TeamSheetScaffold(
              icon: Icons.donut_large_rounded,
              title: 'Status mix',
              color: TeamColors.indigo,
              child: Column(
                children: [
                  for (final st in _statusOrder)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: statusColor(st).withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Icon(
                          statusIcon(st),
                          size: 18,
                          color: statusColor(st),
                        ),
                      ),
                      title: Text(
                        statusLabel(st),
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      trailing: Text(
                        '${s.status(st)}',
                        style: AppText.display(
                          size: 18,
                          color: statusColor(st),
                        ),
                      ),
                      onTap: () {
                        Navigator.of(sheetContext).pop();
                        _setStatus(st);
                      },
                    ),
                ],
              ),
            ),
          ),
          child: slices.isEmpty
              ? Text(
                  'No people yet.',
                  style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                )
              : DonutChart(slices: slices, size: 84),
        ),
        TeamInsightCard(
          icon: Icons.key_rounded,
          title: 'People by role',
          color: TeamColors.violet,
          child: TeamBarRows(
            rows: roleRows,
            colors: [for (final r in s.byRole) iamRoleColor(r.name)],
            onRowTap: (i) {
              final name = s.byRole[i].name;
              for (final r in widget.roles) {
                if (r.name == name) {
                  _setRole(r.id, displayRoleName(r.name));
                  teamSnack(context, 'Filtering by ${displayRoleName(name)}');
                  return;
                }
              }
            },
          ),
        ),
        TeamInsightCard(
          icon: Icons.schedule_rounded,
          title: 'Last sign-in',
          color: TeamColors.teal,
          trailing: '${s.total} people',
          child: _signInBars(s),
        ),
        TeamInsightCard(
          icon: Icons.notification_important_rounded,
          title: 'Needs attention',
          color: TeamColors.rose,
          trailing: attention == 0 ? null : '$attention',
          child: s.nothingToFlag
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
                    group('Locked account', TeamColors.rose, s.locked),
                    group(
                      'Invited, not verified',
                      TeamColors.amber,
                      s.pendingVerification,
                    ),
                    group(
                      'No sign-in for 30+ days',
                      TeamColors.sky,
                      s.dormant,
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: reload,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: TeamCenter(child: _header())),
            BlocBuilder<PaginatedListCubit<IamUser>,
                PaginatedListState<IamUser>>(
              builder: (context, state) => switch (state) {
                PaginatedListLoading() => const SliverFillRemaining(
                    hasScrollBody: false,
                    child: AppLoadingView(),
                  ),
                PaginatedListError(:final message) => SliverFillRemaining(
                    hasScrollBody: false,
                    child: AppErrorView(message: message, onRetry: _cubit.load),
                  ),
                PaginatedListLoaded(:final items) when items.isEmpty =>
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: AppEmptyState(
                      icon: Icons.people_outline,
                      title: 'No users found',
                      message: (_search.isNotEmpty ||
                              _status != null ||
                              _roleId != null ||
                              _branchId != null)
                          ? 'No users match these filters.'
                          : 'Tap + to add or invite someone.',
                    ),
                  ),
                PaginatedListLoaded(
                  :final items,
                  :final hasMore,
                  :final loadingMore,
                ) =>
                  teamCardSliver<IamUser>(
                    context,
                    items: items,
                    footer: hasMore
                        ? Center(
                            child: loadingMore
                                ? const CircularProgressIndicator()
                                : TextButton(
                                    onPressed: _cubit.loadMore,
                                    child: const Text('Load more'),
                                  ),
                          )
                        : null,
                    builder: (u, i) => FadeUp(
                      index: i.clamp(0, 6),
                      child: _UserCard(
                        user: u,
                        busy: _busyId == u.id,
                        canManage: teamCan(context, 'users:manage') &&
                            teamSelfId(context) != u.id,
                        onOpen: () => _open(u.id),
                        onAction: (a) => _act(u, a),
                      ),
                    ),
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.onOpenStaff != null) ...[
            GestureDetector(
              onTap: widget.onOpenStaff,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4338CA), Color(0xFF7C3AED)],
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: const Icon(
                        Icons.badge_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Staff directory',
                            style: AppText.body(
                              size: 14,
                              weight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'HR profiles, employment & branch assignments',
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.arrow_forward_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
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
            hint: 'Search name, email or phone…',
            onSearch: (v) {
              _search = v;
              _cubit.load();
            },
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.shield_outlined,
                  label: _roleName ?? 'All roles',
                  active: _roleId != null,
                  onTap: _pickRole,
                ),
              ),
              if (_branches.length > 1) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: TeamToolbarButton(
                    icon: Icons.place_outlined,
                    label: _branchName ?? 'All branches',
                    active: _branchId != null,
                    onTap: _pickBranch,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final c in _statusChips) ...[
                  TeamFilterChip(
                    label: c.label,
                    color: c.color,
                    selected: _status == c.value,
                    onTap: () => _setStatus(c.value),
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

class _SheetButton extends StatelessWidget {
  const _SheetButton({
    required this.label,
    required this.color,
    required this.onTap,
  });

  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 12),
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
                label,
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
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({
    required this.user,
    required this.busy,
    required this.canManage,
    required this.onOpen,
    required this.onAction,
  });

  final IamUser user;
  final bool busy;
  final bool canManage;
  final VoidCallback onOpen;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final u = user;
    final tone = statusColor(u.status, deleted: u.isDeleted);
    final items = <PopupMenuEntry<String>>[
      if (canManage) ...[
        if (u.needsRestore)
          const PopupMenuItem(value: 'restore', child: Text('Restore'))
        else ...[
          const PopupMenuItem(value: 'suspend', child: Text('Suspend')),
          const PopupMenuItem(value: 'deactivate', child: Text('Deactivate')),
        ],
        if (!u.isDeleted)
          const PopupMenuItem(
            value: 'delete',
            child: Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
      ],
    ];
    final branchLabel = u.allBranches
        ? 'All branches'
        : u.branches.isEmpty
            ? 'No branch access'
            : u.branches.length == 1
                ? u.branches.first.branchName
                : '${u.branches.first.branchName} +${u.branches.length - 1}';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onOpen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                      statusIcon(u.status, deleted: u.isDeleted),
                      size: 14,
                      color: tone,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      statusLabel(u.status, deleted: u.isDeleted),
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: tone,
                      ),
                    ),
                    const Spacer(),
                    if (busy)
                      const Padding(
                        padding: EdgeInsets.only(right: 10),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    else if (items.isNotEmpty)
                      PopupMenuButton<String>(
                        padding: EdgeInsets.zero,
                        color: AppColors.surface2,
                        tooltip: 'Actions for ${u.name}',
                        icon: Icon(
                          Icons.more_horiz_rounded,
                          size: 20,
                          color: AppColors.inkSoft,
                        ),
                        onSelected: onAction,
                        itemBuilder: (_) => items,
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
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
                              avatarUrl: u.avatarUrl,
                              name: u.name,
                              size: 50,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                u.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 15.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                u.email,
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
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 5,
                      children: [
                        for (final r in u.roles)
                          TeamTag(
                            label: displayRoleName(r.name),
                            color: iamRoleColor(r.name),
                            icon: iamRoleIcon(r.name),
                          ),
                        if (u.roles.isEmpty)
                          const TeamTag(
                            label: 'No role',
                            color: TeamColors.slate,
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _Mini(
                          icon: Icons.place_rounded,
                          color: TeamColors.amber,
                          text: branchLabel,
                        ),
                        _Mini(
                          icon: Icons.login_rounded,
                          color: TeamColors.sky,
                          text: u.lastLoginAt == null
                              ? 'Never signed in'
                              : relativeAgo(u.lastLoginAt),
                        ),
                        _Mini(
                          icon: u.mfaEnabled
                              ? Icons.shield_moon_rounded
                              : Icons.shield_outlined,
                          color: u.mfaEnabled
                              ? TeamColors.green
                              : AppColors.inkFaint,
                          text: u.mfaEnabled ? '2FA on' : '2FA off',
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
}

class _Mini extends StatelessWidget {
  const _Mini({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w700,
                color: AppColors.inkSoft,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

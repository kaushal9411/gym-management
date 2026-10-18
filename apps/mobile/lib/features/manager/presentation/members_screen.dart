import 'dart:async';

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
import '../../../core/utils/formatters.dart';
import '../../../models/gym_member.dart';
import '../../../models/member_stats.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../reports/presentation/widgets/simple_bar_chart.dart';

/// No token in `AppColors` for this one — it's the mockup/web "primary"
/// indigo accent, used here only as a 6th rotation color alongside the
/// existing staff/member/status tokens (same reasoning as the drawer's
/// `_sectionAccents` in `app_drawer.dart`).
const _indigo = Color(0xFF6366F1);

const _statusTones = {
  'ACTIVE': AppPillTone.success,
  'FROZEN': AppPillTone.danger,
  'INACTIVE': AppPillTone.neutral,
};

const _statusFilters = [
  (label: 'All', value: null),
  (label: 'Active', value: 'ACTIVE'),
  (label: 'Inactive', value: 'INACTIVE'),
  (label: 'Frozen', value: 'FROZEN'),
];

const _sortOptions = [
  (value: 'createdAt', dir: 'desc', label: 'Newest first'),
  (value: 'createdAt', dir: 'asc', label: 'Oldest first'),
  (value: 'name', dir: 'asc', label: 'Name (A-Z)'),
  (value: 'name', dir: 'desc', label: 'Name (Z-A)'),
  (value: 'memberId', dir: 'asc', label: 'Member ID (A-Z)'),
  (value: 'joiningDate', dir: 'desc', label: 'Joining date (newest)'),
  (value: 'joiningDate', dir: 'asc', label: 'Joining date (oldest)'),
];

/// Design frame "6. Members list" — search + status filter + roster
/// (`GET /members`, branch-scoped server-side for Manager/Receptionist),
/// now brought to parity with web's `/members` page: the same KPI tiles
/// and report panels (`GET /members/stats`), trainer/sort filters, and a
/// richer roster card (validity bar, visit/branch/trainer stats).
///
/// **Dropped vs. web** (documented, not silently skipped):
/// - CSV export/import — desktop file-handling flows with no mobile
///   file-picker/share-sheet wiring for this content type yet (same call
///   made for Leads' CSV export).
/// - Multi-select + bulk activate/deactivate/delete bar, and the per-card
///   "More actions" dropdown (view/assign membership/activate/deactivate/
///   restore/delete) — reachable today by tapping into the member detail
///   screen instead, which already has this exact menu; adding a second
///   copy of it at the list-row level is a real increase in scope for a
///   screen this already covers thoroughly.
/// - Grid/list view toggle — mobile is a single column regardless of
///   which "view" you'd pick; web's two variants mainly differ in density
///   for a multi-column desktop layout, which doesn't apply here.
/// - The web hero's decorative overlapping-avatar strip — kept the
///   existing plain header (hamburger + count + title + Add) instead, for
///   consistency with every other non-Home mobile tab; the extra space
///   went to the KPI/insights panels below instead, which are the parts
///   that actually differed in DATA, not just chrome.
class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  final _searchController = TextEditingController();
  String? _status;
  String? _trainerId;
  String? _trainerName;
  String _sortBy = 'createdAt';
  String _sortDir = 'desc';
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<GymMember>(
    (page) => getIt<MemberRepository>().list(
      page: page,
      search: _searchController.text.trim(),
      status: _status,
      trainerId: _trainerId,
      sortBy: _sortBy,
      sortDir: _sortDir,
    ),
  );

  MemberStats? _stats;
  String? _statsError;

  @override
  void initState() {
    super.initState();
    _cubit.load();
    _loadStats();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  Future<void> _loadStats() async {
    try {
      final stats = await getIt<MemberRepository>().stats();
      if (mounted) {
        setState(() {
          _stats = stats;
          _statsError = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _statsError = e.message);
    }
  }

  Future<void> _refresh() async {
    _cubit.load();
    await _loadStats();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _cubit.load);
  }

  void _onStatusChanged(String? status) {
    setState(() => _status = status);
    _cubit.load();
  }

  Future<void> _openSortSheet() async {
    final picked = await showModalBottomSheet<(String, String)>(
      context: context,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
              child: Text('Sort by', style: AppText.display(size: 16)),
            ),
            for (final o in _sortOptions)
              ListTile(
                title: Text(
                  o.label,
                  style: AppText.body(size: 14, weight: FontWeight.w600),
                ),
                trailing: _sortBy == o.value && _sortDir == o.dir
                    ? Icon(Icons.check_rounded, color: AppColors.staffB)
                    : null,
                onTap: () => Navigator.of(context).pop((o.value, o.dir)),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked != null) {
      setState(() {
        _sortBy = picked.$1;
        _sortDir = picked.$2;
      });
      _cubit.load();
    }
  }

  Future<void> _openTrainerSheet() async {
    final picked = await showModalBottomSheet<(String?, String?)>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (context) => const _TrainerFilterSheet(),
    );
    if (picked != null) {
      setState(() {
        _trainerId = picked.$1;
        _trainerName = picked.$2;
      });
      _cubit.load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<GymMember>>.value(
      value: _cubit,
      child: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: _refresh,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _MembersHero(stats: _stats)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _MemberKpiGrid(
                      stats: _stats,
                      status: _status,
                      onStatus: _onStatusChanged,
                    ),
                    const SizedBox(height: 14),
                    if (_statsError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: AppErrorView(
                          message: _statsError!,
                          onRetry: _loadStats,
                        ),
                      )
                    else if (_stats != null)
                      _MemberInsights(
                        stats: _stats!,
                        onStatus: _onStatusChanged,
                      ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _searchController,
                      onChanged: _onSearchChanged,
                      style: AppText.body(size: 14, weight: FontWeight.w600),
                      decoration: InputDecoration(
                        hintText: 'Search name, member ID, or phone…',
                        hintStyle:
                            AppText.body(size: 14, color: AppColors.inkFaint),
                        filled: true,
                        fillColor: AppColors.surface2,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.field),
                          borderSide: BorderSide(color: AppColors.line),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.field),
                          borderSide: BorderSide(color: AppColors.line),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _ToolbarButton(
                            icon: Icons.badge_outlined,
                            label: _trainerName ?? 'All trainers',
                            onTap: _openTrainerSheet,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _ToolbarButton(
                            icon: Icons.sort_rounded,
                            label: _sortOptions
                                .firstWhere(
                                  (o) =>
                                      o.value == _sortBy && o.dir == _sortDir,
                                )
                                .label,
                            onTap: _openSortSheet,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        for (final f in _statusFilters) ...[
                          _FilterChip(
                            label: f.label,
                            selected: _status == f.value,
                            onTap: () => _onStatusChanged(f.value),
                          ),
                          const SizedBox(width: 8),
                        ],
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
            BlocBuilder<PaginatedListCubit<GymMember>,
                PaginatedListState<GymMember>>(
              builder: (context, state) {
                return switch (state) {
                  PaginatedListLoading() => const SliverFillRemaining(
                      hasScrollBody: false,
                      child: AppLoadingView(),
                    ),
                  PaginatedListError(:final message) => SliverFillRemaining(
                      hasScrollBody: false,
                      child:
                          AppErrorView(message: message, onRetry: _cubit.load),
                    ),
                  PaginatedListLoaded(:final items) when items.isEmpty =>
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: AppEmptyState(
                        icon: Icons.people_alt_outlined,
                        title: 'No members found',
                        message: 'Tap + to add your first member.',
                      ),
                    ),
                  PaginatedListLoaded(:final items) => SliverPadding(
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 90),
                      sliver: SliverList.builder(
                        itemCount: items.length,
                        itemBuilder: (context, i) => _MemberCard(
                          member: items[i],
                          onChanged: _refresh,
                        ),
                      ),
                    ),
                };
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ToolbarButton extends StatelessWidget {
  const _ToolbarButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.field),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.field),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Icon(icon, size: 15, color: AppColors.inkFaint),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrainerFilterSheet extends StatefulWidget {
  const _TrainerFilterSheet();

  @override
  State<_TrainerFilterSheet> createState() => _TrainerFilterSheetState();
}

class _TrainerFilterSheetState extends State<_TrainerFilterSheet> {
  List<StaffMember>? _results;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await getIt<StaffRepository>()
          .list(role: StaffRole.trainer, status: 'ACTIVE');
      if (mounted) setState(() => _results = result.items);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Filter by trainer', style: AppText.display(size: 16)),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'All trainers',
              style: AppText.body(size: 14, weight: FontWeight.w700),
            ),
            onTap: () => Navigator.of(context).pop((null, null)),
          ),
          SizedBox(
            height: 320,
            child: _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : _results == null
                    ? const AppLoadingView()
                    : _results!.isEmpty
                        ? const AppEmptyState(
                            icon: Icons.person_search_outlined,
                            title: 'No trainers found',
                          )
                        : ListView.builder(
                            itemCount: _results!.length,
                            itemBuilder: (context, i) {
                              final t = _results![i];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Container(
                                  width: 30,
                                  height: 30,
                                  decoration: const BoxDecoration(
                                    gradient: AppColors.staffGrad,
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    t.name.isEmpty
                                        ? '?'
                                        : t.name[0].toUpperCase(),
                                    style: AppText.body(
                                      size: 11,
                                      weight: FontWeight.w800,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                title: Text(
                                  t.name,
                                  style: AppText.body(
                                    size: 14,
                                    weight: FontWeight.w600,
                                  ),
                                ),
                                onTap: () =>
                                    Navigator.of(context).pop((t.id, t.name)),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _KpiTile {
  const _KpiTile({
    required this.label,
    required this.value,
    required this.color,
    this.status,
  });

  final String label;
  final int value;
  final Color color;
  final String? status; // null = not a filter tile; '' = the "All" tile.

  bool matches(String? current) =>
      status == '' ? current == null : current == status;
}

class _MemberKpiGrid extends StatelessWidget {
  const _MemberKpiGrid({
    required this.stats,
    required this.status,
    required this.onStatus,
  });

  final MemberStats? stats;
  final String? status;
  final ValueChanged<String?> onStatus;

  @override
  Widget build(BuildContext context) {
    final s = stats;
    final tiles = [
      _KpiTile(
        label: 'Total members',
        value: s?.total ?? 0,
        color: _indigo,
        status: '',
      ),
      _KpiTile(
        label: 'Active',
        value: s?.byStatus.active ?? 0,
        color: AppColors.success,
        status: 'ACTIVE',
      ),
      _KpiTile(
        label: 'Inactive',
        value: s?.byStatus.inactive ?? 0,
        color: AppColors.warning,
        status: 'INACTIVE',
      ),
      _KpiTile(
        label: 'Frozen',
        value: s?.byStatus.frozen ?? 0,
        color: AppColors.memberB,
        status: 'FROZEN',
      ),
      _KpiTile(
        label: 'New this month',
        value: s?.newThisMonth ?? 0,
        color: AppColors.staffB,
      ),
      _KpiTile(
        label: 'Expiring in 30 days',
        value: s?.expiringIn30Days ?? 0,
        color: AppColors.warning,
      ),
      _KpiTile(
        label: s == null
            ? 'With dues'
            : 'With dues · ${Formatters.currencyCompact(s.withDuesAmount)}',
        value: s?.withDuesCount ?? 0,
        color: AppColors.danger,
      ),
      _KpiTile(
        label: 'Checked in today',
        value: s?.checkedInToday ?? 0,
        color: AppColors.memberB,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: tiles.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        mainAxisExtent: 86,
      ),
      itemBuilder: (context, i) {
        final t = tiles[i];
        final clickable = s != null;
        final active = t.status != null && t.matches(status);
        return Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: clickable
                ? () => _openKpiDetail(context, t, s, onStatus)
                : null,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [t.color.withValues(alpha: 0.14), Colors.transparent],
                ),
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: active ? t.color : t.color.withValues(alpha: 0.22),
                  width: active ? 1.4 : 1,
                ),
              ),
              child: stats == null
                  ? const SizedBox.shrink()
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${t.value}',
                          style: AppText.display(size: 22, color: t.color),
                        ),
                        Expanded(
                          child: Text(
                            t.label,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 10.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        );
      },
    );
  }
}

void _openKpiDetail(
  BuildContext context,
  _KpiTile t,
  MemberStats s,
  ValueChanged<String?> onStatus,
) {
  _openCardDetail<void>(
    context,
    (sheetContext) => _KpiMembersSheet(tile: t, stats: s, onStatus: onStatus),
  );
}

class _KpiMembersSheet extends StatefulWidget {
  const _KpiMembersSheet({
    required this.tile,
    required this.stats,
    required this.onStatus,
  });

  final _KpiTile tile;
  final MemberStats stats;
  final ValueChanged<String?> onStatus;

  @override
  State<_KpiMembersSheet> createState() => _KpiMembersSheetState();
}

class _KpiMembersSheetState extends State<_KpiMembersSheet> {
  List<GymMember>? _members;
  String? _error;

  String get _name => widget.tile.label.split(' ·').first;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final repo = getIt<MemberRepository>();
      final status = widget.tile.status;
      final all = <GymMember>[];
      var page = 1;
      while (true) {
        final res = await repo.list(
          page: page,
          limit: 100,
          status: (status == null || status.isEmpty) ? null : status,
        );
        all.addAll(res.items);
        if (page >= res.totalPages || page >= 20) break;
        page++;
      }
      if (mounted) setState(() => _members = _filter(all));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  List<GymMember> _filter(List<GymMember> all) {
    final now = DateTime.now();
    switch (_name) {
      case 'New this month':
        return all
            .where(
              (m) =>
                  m.createdAt.toLocal().year == now.year &&
                  m.createdAt.toLocal().month == now.month,
            )
            .toList();
      case 'Expiring in 30 days':
        final limit = now.add(const Duration(days: 30));
        return all
            .where(
              (m) =>
                  m.currentMembership != null &&
                  !m.currentMembership!.endDate.isBefore(now) &&
                  !m.currentMembership!.endDate.isAfter(limit),
            )
            .toList()
          ..sort(
            (a, b) => a.currentMembership!.endDate
                .compareTo(b.currentMembership!.endDate),
          );
      case 'With dues':
        return all.where((m) => m.outstandingAmount > 0).toList()
          ..sort((a, b) => b.outstandingAmount.compareTo(a.outstandingAmount));
      case 'Checked in today':
        return all.where((m) {
          final c = m.lastCheckInAt?.toLocal();
          return c != null &&
              c.year == now.year &&
              c.month == now.month &&
              c.day == now.day;
        }).toList();
      default:
        return all;
    }
  }

  String _detail(GymMember m) {
    switch (_name) {
      case 'With dues':
        return 'Due ${Formatters.currencyCompact(m.outstandingAmount)}';
      case 'Expiring in 30 days':
        return 'Ends ${_fmtDate(m.currentMembership!.endDate)}';
      case 'Checked in today':
        return 'Visits this month ${m.visitsThisMonth}';
      case 'New this month':
        return 'Joined ${_fmtDate(m.joiningDate)}';
      default:
        return m.currentMembership?.planName ?? 'No plan';
    }
  }

  static String _fmtDate(DateTime d) {
    const mo = [
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
    final l = d.toLocal();
    return '${l.day} ${mo[l.month - 1]} ${l.year}';
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tile;
    final s = widget.stats;
    final share = s.total > 0 ? (t.value / s.total * 100).round() : 0;
    final members = _members;
    return _DetailSheetScaffold(
      icon: Icons.insights_rounded,
      title: _name,
      color: t.color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${t.value}',
                style: AppText.display(size: 36, color: t.color),
              ),
              const SizedBox(width: 10),
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Text(
                  'of ${s.total} members · $share%',
                  style: AppText.body(
                    size: 13,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            height: 8,
            decoration: BoxDecoration(
              color: AppColors.surface3,
              borderRadius: BorderRadius.circular(9),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: (share / 100).clamp(0.02, 1),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(9),
                  gradient: LinearGradient(
                    colors: [t.color, t.color.withValues(alpha: 0.55)],
                  ),
                ),
              ),
            ),
          ),
          if (_name == 'With dues') ...[
            const SizedBox(height: 10),
            Text(
              'Total outstanding: ${Formatters.currencyCompact(s.withDuesAmount)}',
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: t.color,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Text(
            members == null ? 'MEMBERS' : 'MEMBERS (${members.length})',
            style: AppText.body(
              size: 10,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ).copyWith(letterSpacing: 0.8),
          ),
          const SizedBox(height: 8),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Text(
                _error!,
                style: AppText.body(size: 13, color: AppColors.danger),
              ),
            )
          else if (members == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
            )
          else if (members.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'No members match right now.',
                  style: AppText.body(size: 13, color: AppColors.inkFaint),
                ),
              ),
            )
          else
            for (final m in members)
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () =>
                      context.push(AppRoutes.memberDetail, extra: m.id),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surface3.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        UserAvatar(
                          avatarUrl: m.profilePhotoUrl,
                          name: m.name,
                          size: 44,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                m.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 13.5,
                                  weight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                [
                                  m.memberId,
                                  if (m.phone != null && m.phone!.isNotEmpty)
                                    m.phone!,
                                ].join(' · '),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 10.5,
                                  color: AppColors.inkFaint,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  AppPill(
                                    label: m.status,
                                    tone: _statusTones[m.status] ??
                                        AppPillTone.neutral,
                                  ),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Text(
                                      _detail(m),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.body(
                                        size: 11,
                                        weight: FontWeight.w700,
                                        color: t.color,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 16,
                          color: AppColors.inkFaint,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          if (t.status != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  widget.onStatus(t.status == '' ? null : t.status);
                  Navigator.of(context).pop();
                },
                child: Text(
                  t.status == ''
                      ? 'Show all in main list'
                      : 'Filter main list by ${_name.toLowerCase()}',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Opens [content] as a modal bottom sheet — Flutter's stock sheet already
/// slides bottom-to-top on its own, no custom animation needed (unlike the
/// drawer, which genuinely needed one). Every insight panel below opens its
/// "more detail" view this way.
Future<T?> _openCardDetail<T>(BuildContext context, WidgetBuilder content) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface2,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
    ),
    builder: content,
  );
}

/// Shared chrome for a bottom-sheet detail view: a drag handle, icon+title
/// header, and a scrollable body capped well short of the full screen.
class _DetailSheetScaffold extends StatelessWidget {
  const _DetailSheetScaffold({
    required this.icon,
    required this.title,
    required this.color,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: Icon(icon, size: 16, color: color),
                  ),
                  const SizedBox(width: 10),
                  Text(title, style: AppText.display(size: 17)),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dashboard-style section card: a tinted gradient header band (icon chip +
/// title + optional count badge + a chevron hinting it's tappable) over a
/// plain body — tapping anywhere opens [onTap]'s "more detail" sheet.
class _InsightPanelCard extends StatelessWidget {
  const _InsightPanelCard({
    required this.icon,
    required this.title,
    required this.color,
    required this.onTap,
    required this.child,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback onTap;
  final Widget child;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [color.withValues(alpha: 0.16), Colors.transparent],
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      alignment: Alignment.center,
                      child: Icon(icon, size: 14, color: color),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        title,
                        style: AppText.body(
                          size: 14,
                          weight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (trailing != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          trailing!,
                          style: AppText.body(
                            size: 10.5,
                            weight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                    ],
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: child,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BarRows extends StatelessWidget {
  const _BarRows({
    required this.buckets,
    required this.colors,
    this.barHeight = 7,
    this.showPercent = false,
  });

  final List<MemberStatsBucket> buckets;
  final List<Color> colors;
  final double barHeight;
  final bool showPercent;

  @override
  Widget build(BuildContext context) {
    if (buckets.isEmpty) {
      return Text(
        'No data yet.',
        style: AppText.body(size: 12.5, color: AppColors.inkFaint),
      );
    }
    final max = buckets.map((b) => b.count).fold(1, (a, b) => b > a ? b : a);
    final total = buckets.fold(0, (a, b) => a + b.count);
    return Column(
      children: [
        for (var i = 0; i < buckets.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      buckets[i].label,
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    showPercent && total > 0
                        ? '${buckets[i].count} · ${(buckets[i].count / total * 100).round()}%'
                        : '${buckets[i].count}',
                    style: AppText.body(
                      size: 12,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Container(
                height: barHeight,
                decoration: BoxDecoration(
                  color: AppColors.surface3,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: (buckets[i].count / max).clamp(0.02, 1),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(9),
                      gradient: LinearGradient(
                        colors: [
                          colors[i % colors.length],
                          colors[i % colors.length].withValues(alpha: 0.55),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// One category inside the Needs Attention sheet — a fuller row than the
/// compact card preview (bigger avatar, member ID shown, a tinted detail
/// chip instead of plain caption text) using exactly the same backend
/// fields (`MemberStatsPerson` has no phone/photo to show — `GET
/// /members/stats` genuinely doesn't return them for these short lists, so
/// nothing here is invented, just laid out with more room to breathe).
class _NeedsAttentionGroup extends StatelessWidget {
  const _NeedsAttentionGroup({
    required this.people,
    required this.color,
    required this.emptyLabel,
  });

  final List<MemberStatsPerson> people;
  final Color color;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    if (people.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Text(
            emptyLabel,
            style: AppText.body(size: 13, color: AppColors.inkFaint),
          ),
        ),
      );
    }
    return Column(
      children: [
        for (final p in people)
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => context.push(AppRoutes.memberDetail, extra: p.id),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surface3.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        p.name.isEmpty ? '?' : p.name[0].toUpperCase(),
                        style: AppText.body(
                          size: 14,
                          weight: FontWeight.w800,
                          color: color,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            p.memberId,
                            style: AppText.body(
                              size: 10.5,
                              color: AppColors.inkFaint,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        p.detail,
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 16,
                      color: AppColors.inkFaint,
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The Needs Attention detail sheet — one segmented control switching
/// between the three categories instead of three stacked lists, so each
/// gets the full sheet's width/height rather than a cramped few rows.
class _NeedsAttentionDetailSheet extends StatefulWidget {
  const _NeedsAttentionDetailSheet({required this.stats});

  final MemberStats stats;

  @override
  State<_NeedsAttentionDetailSheet> createState() =>
      _NeedsAttentionDetailSheetState();
}

class _NeedsAttentionDetailSheetState
    extends State<_NeedsAttentionDetailSheet> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final s = widget.stats;
    final tabs = [
      (
        label: 'Not visited',
        icon: Icons.history_toggle_off_rounded,
        color: AppColors.memberB,
        people: s.notVisited14Days,
        empty: 'Everyone has visited in the last 14 days.'
      ),
      (
        label: 'Expiring',
        icon: Icons.event_busy_rounded,
        color: AppColors.warning,
        people: s.expiringThisWeek,
        empty: 'Nothing expiring this week.'
      ),
      (
        label: 'Highest dues',
        icon: Icons.account_balance_wallet_rounded,
        color: AppColors.danger,
        people: s.highestDues,
        empty: 'Nobody has dues right now.'
      ),
    ];
    final active = tabs[_tab];
    return _DetailSheetScaffold(
      icon: Icons.access_time_filled_rounded,
      title: 'Needs attention',
      color: AppColors.danger,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              for (var i = 0; i < tabs.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _tab = i),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: _tab == i
                            ? tabs[i].color.withValues(alpha: 0.16)
                            : AppColors.surface3,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _tab == i ? tabs[i].color : Colors.transparent,
                        ),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            tabs[i].icon,
                            size: 16,
                            color:
                                _tab == i ? tabs[i].color : AppColors.inkFaint,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${tabs[i].people.length}',
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w800,
                              color: _tab == i ? tabs[i].color : AppColors.ink,
                            ),
                          ),
                          Text(
                            tabs[i].label,
                            style: AppText.body(
                              size: 9.5,
                              color: AppColors.inkFaint,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          _NeedsAttentionGroup(
            people: active.people,
            color: active.color,
            emptyLabel: active.empty,
          ),
        ],
      ),
    );
  }
}

class _MemberInsights extends StatelessWidget {
  const _MemberInsights({required this.stats, required this.onStatus});

  final MemberStats stats;
  final ValueChanged<String?> onStatus;

  @override
  Widget build(BuildContext context) {
    final byStatus = stats.byStatus;
    return Column(
      children: [
        _InsightPanelCard(
          icon: Icons.people_alt_rounded,
          title: 'Status mix',
          color: _indigo,
          onTap: () => _openCardDetail<String?>(
            context,
            (sheetContext) => _DetailSheetScaffold(
              icon: Icons.people_alt_rounded,
              title: 'Status mix',
              color: _indigo,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        DonutChart(
                          size: 140,
                          slices: [
                            DonutSlice(
                              label: 'Active',
                              value: byStatus.active,
                              color: AppColors.success,
                            ),
                            DonutSlice(
                              label: 'Frozen',
                              value: byStatus.frozen,
                              color: AppColors.memberB,
                            ),
                            DonutSlice(
                              label: 'Inactive',
                              value: byStatus.inactive,
                              color: AppColors.warning,
                            ),
                          ],
                        ),
                        Positioned(
                          left: 0,
                          width: 140,
                          child: IgnorePointer(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '${stats.total}',
                                  style: AppText.display(size: 24),
                                ),
                                Text(
                                  'members',
                                  style: AppText.body(
                                    size: 10.5,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  for (final row in [
                    (
                      label: 'Active',
                      value: byStatus.active,
                      color: AppColors.success,
                      status: 'ACTIVE'
                    ),
                    (
                      label: 'Frozen',
                      value: byStatus.frozen,
                      color: AppColors.memberB,
                      status: 'FROZEN'
                    ),
                    (
                      label: 'Inactive',
                      value: byStatus.inactive,
                      color: AppColors.warning,
                      status: 'INACTIVE'
                    ),
                  ])
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          onStatus(row.status);
                          Navigator.of(sheetContext).pop();
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Row(
                            children: [
                              Container(
                                width: 10,
                                height: 10,
                                decoration: BoxDecoration(
                                  color: row.color,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  row.label,
                                  style: AppText.body(
                                    size: 14,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text(
                                '${row.value} · ${stats.total > 0 ? (row.value / stats.total * 100).round() : 0}%',
                                style: AppText.body(
                                  size: 13,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Icon(
                                Icons.chevron_right_rounded,
                                size: 16,
                                color: AppColors.inkFaint,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${stats.total} members',
                style: AppText.body(
                  size: 11.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Stack(
                alignment: Alignment.center,
                children: [
                  DonutChart(
                    size: 84,
                    slices: [
                      DonutSlice(
                        label: 'Active',
                        value: byStatus.active,
                        color: AppColors.success,
                      ),
                      DonutSlice(
                        label: 'Frozen',
                        value: byStatus.frozen,
                        color: AppColors.memberB,
                      ),
                      DonutSlice(
                        label: 'Inactive',
                        value: byStatus.inactive,
                        color: AppColors.warning,
                      ),
                    ],
                  ),
                  Positioned(
                    left: 0,
                    width: 84,
                    child: IgnorePointer(
                      child: Text(
                        '${stats.total}',
                        textAlign: TextAlign.center,
                        style: AppText.body(size: 16, weight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _InsightPanelCard(
          icon: Icons.person_add_alt_1_rounded,
          title: 'Joinings, last 6 months',
          color: AppColors.staffB,
          trailing: '+${stats.joinedByMonth.fold(0, (s, m) => s + m.count)}',
          onTap: () => _openCardDetail<void>(
            context,
            (_) => _DetailSheetScaffold(
              icon: Icons.person_add_alt_1_rounded,
              title: 'Joinings, last 6 months',
              color: AppColors.staffB,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SimpleBarChart(
                    height: 120,
                    data: stats.joinedByMonth
                        .map((m) => BarDatum(label: m.month, value: m.count))
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  for (final m in stats.joinedByMonth)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              m.month,
                              style: AppText.body(
                                size: 13,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Text(
                            '${m.count} joined',
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w700,
                              color: AppColors.staffB,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          child: SimpleBarChart(
            data: stats.joinedByMonth
                .map((m) => BarDatum(label: m.month, value: m.count))
                .toList(),
          ),
        ),
        const SizedBox(height: 12),
        _InsightPanelCard(
          icon: Icons.card_membership_rounded,
          title: 'Plans',
          color: AppColors.memberB,
          onTap: () => _openCardDetail<void>(
            context,
            (_) => _DetailSheetScaffold(
              icon: Icons.card_membership_rounded,
              title: 'Plans',
              color: AppColors.memberB,
              child: _BarRows(
                buckets: stats.plans,
                colors: const [
                  AppColors.memberB,
                  _indigo,
                  AppColors.staffB,
                  AppColors.warning,
                ],
                barHeight: 10,
                showPercent: true,
              ),
            ),
          ),
          child: _BarRows(
            buckets: stats.plans,
            colors: const [
              AppColors.memberB,
              _indigo,
              AppColors.staffB,
              AppColors.warning,
            ],
          ),
        ),
        const SizedBox(height: 12),
        _InsightPanelCard(
          icon: Icons.wc_rounded,
          title: 'Gender',
          color: AppColors.danger,
          onTap: () => _openCardDetail<void>(
            context,
            (_) => _DetailSheetScaffold(
              icon: Icons.wc_rounded,
              title: 'Gender',
              color: AppColors.danger,
              child: _BarRows(
                buckets: stats.gender,
                colors: const [_indigo, AppColors.danger, AppColors.warning],
                barHeight: 10,
                showPercent: true,
              ),
            ),
          ),
          child: _BarRows(
            buckets: stats.gender,
            colors: const [_indigo, AppColors.danger, AppColors.warning],
          ),
        ),
        const SizedBox(height: 12),
        _InsightPanelCard(
          icon: Icons.campaign_rounded,
          title: 'Heard about us',
          color: AppColors.warning,
          onTap: () => _openCardDetail<void>(
            context,
            (_) => _DetailSheetScaffold(
              icon: Icons.campaign_rounded,
              title: 'Heard about us',
              color: AppColors.warning,
              child: _BarRows(
                buckets: stats.source,
                colors: const [
                  AppColors.warning,
                  AppColors.staffB,
                  AppColors.memberB,
                  _indigo,
                ],
                barHeight: 10,
                showPercent: true,
              ),
            ),
          ),
          child: _BarRows(
            buckets: stats.source,
            colors: const [
              AppColors.warning,
              AppColors.staffB,
              AppColors.memberB,
              _indigo,
            ],
          ),
        ),
        const SizedBox(height: 12),
        _InsightPanelCard(
          icon: Icons.access_time_filled_rounded,
          title: 'Needs attention',
          color: AppColors.danger,
          trailing:
              '${stats.notVisited14Days.length + stats.expiringThisWeek.length + stats.highestDues.length}',
          onTap: () => _openCardDetail<void>(
            context,
            (_) => _NeedsAttentionDetailSheet(stats: stats),
          ),
          child: Column(
            children: [
              _NeedsAttentionPreviewRow(
                icon: Icons.history_toggle_off_rounded,
                label: 'Not visited in 14 days',
                count: stats.notVisited14Days.length,
                color: AppColors.memberB,
              ),
              const SizedBox(height: 8),
              _NeedsAttentionPreviewRow(
                icon: Icons.event_busy_rounded,
                label: 'Expiring this week',
                count: stats.expiringThisWeek.length,
                color: AppColors.warning,
              ),
              const SizedBox(height: 8),
              _NeedsAttentionPreviewRow(
                icon: Icons.account_balance_wallet_rounded,
                label: 'Highest dues',
                count: stats.highestDues.length,
                color: AppColors.danger,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Compact one-line summary shown on the card face (tap the card for the
/// full per-category list via [_NeedsAttentionDetailSheet]).
class _NeedsAttentionPreviewRow extends StatelessWidget {
  const _NeedsAttentionPreviewRow({
    required this.icon,
    required this.label,
    required this.count,
    required this.color,
  });

  final IconData icon;
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: AppText.body(size: 12.5, weight: FontWeight.w600),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            '$count',
            style: AppText.body(
              size: 11.5,
              weight: FontWeight.w800,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? AppColors.staffGrad : null,
          color: selected ? null : AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}

/// Rich roster card — mirrors web's `MemberListCard`: photo, ID, mobile,
/// due amount, plan + validity progress, visits/last-visit/trainer stats,
/// branch, and one-tap Call / WhatsApp / Renew / Punch In. Renew and Punch
/// In hit the real endpoints and surface the backend's own rejection
/// (e.g. "still active until …", "no active membership") rather than
/// re-implementing eligibility here.
class _MemberCard extends StatefulWidget {
  const _MemberCard({required this.member, required this.onChanged});

  final GymMember member;
  final VoidCallback onChanged;

  @override
  State<_MemberCard> createState() => _MemberCardState();
}

class _MemberCardState extends State<_MemberCard> {
  bool _renewing = false;
  bool _checkingIn = false;

  GymMember get m => widget.member;

  /// `9876543210` → `919876543210` — prepends India's code only for a bare
  /// 10-digit local number (same rule as web's `toWhatsAppNumber`).
  String _waNumber(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    return digits.length == 10 ? '91$digits' : digits;
  }

  Future<void> _open(Uri uri) async {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      _toast('Could not open ${uri.scheme == 'tel' ? 'dialer' : 'WhatsApp'}');
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _renew() async {
    setState(() => _renewing = true);
    try {
      await getIt<MemberRepository>().renew(m.id);
      if (!mounted) return;
      _toast('Membership renewed.');
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) _toast(e.message);
    } finally {
      if (mounted) setState(() => _renewing = false);
    }
  }

  Future<void> _punchIn() async {
    setState(() => _checkingIn = true);
    try {
      await getIt<AttendanceRepository>()
          .manualCheckIn(memberId: m.id, branchId: m.branch.id);
      if (mounted) _toast('${m.name} checked in.');
    } on ApiException catch (e) {
      if (mounted) _toast(e.message);
    } finally {
      if (mounted) setState(() => _checkingIn = false);
    }
  }

  String _fmtDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  String _relativeVisit(DateTime? d) {
    if (d == null) return 'Never';
    final days = DateTime.now().difference(d).inDays;
    if (days <= 0) return 'Today';
    if (days == 1) return 'Yesterday';
    return '$days days ago';
  }

  @override
  Widget build(BuildContext context) {
    final membership = m.currentMembership;
    final hasPhone = m.phone != null && m.phone!.isNotEmpty;
    final due = m.outstandingAmount;
    final deleted = m.deletedAt != null;

    final totalDays = membership == null
        ? 0
        : membership.endDate
            .difference(membership.startDate)
            .inDays
            .clamp(1, 100000);
    final daysLeft = membership == null
        ? 0
        : membership.endDate.difference(DateTime.now()).inDays.clamp(0, 100000);
    final expired =
        membership != null && membership.endDate.isBefore(DateTime.now());

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context
              .push(AppRoutes.memberDetail, extra: m.id)
              .then((_) => widget.onChanged()),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        gradient: AppColors.staffGrad,
                        shape: BoxShape.circle,
                      ),
                      child: UserAvatar(
                        avatarUrl: m.profilePhotoUrl,
                        name: m.name,
                        size: 54,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  m.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: 15,
                                    weight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              AppPill(
                                label: deleted ? 'DELETED' : m.status,
                                tone: deleted
                                    ? AppPillTone.neutral
                                    : _statusTones[m.status] ??
                                        AppPillTone.neutral,
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${m.memberId} · Joined ${_fmtDate(m.joiningDate)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w700,
                              color: AppColors.staffPillFg,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface3.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _InfoCell(
                            icon: Icons.phone_iphone_rounded,
                            label: 'Mobile',
                            value: hasPhone ? m.phone! : '—',
                          ),
                          _InfoCell(
                            icon: Icons.account_balance_wallet_rounded,
                            label: 'Due amount',
                            value: Formatters.currency(due),
                            valueColor:
                                due > 0 ? AppColors.danger : AppColors.success,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _InfoCell(
                            icon: Icons.card_membership_rounded,
                            label: 'Plan',
                            value: membership?.planName ?? 'No plan',
                          ),
                          _InfoCell(
                            icon: Icons.badge_outlined,
                            label: 'Trainer',
                            value: m.trainer?.name ?? 'Unassigned',
                          ),
                        ],
                      ),
                      if (membership != null) ...[
                        const SizedBox(height: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    membership.status != 'ACTIVE'
                                        ? membership.status.toLowerCase()
                                        : expired
                                            ? 'Expired'
                                            : '$daysLeft days left',
                                    style: AppText.body(
                                      size: 11.5,
                                      weight: FontWeight.w700,
                                      color: expired
                                          ? AppColors.danger
                                          : AppColors.ink,
                                    ),
                                  ),
                                ),
                                Text(
                                  '$totalDays-day plan · ends ${_fmtDate(membership.endDate)}',
                                  style: AppText.body(
                                    size: 10.5,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: 6,
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: FractionallySizedBox(
                                alignment: Alignment.centerLeft,
                                widthFactor: membership.status != 'ACTIVE'
                                    ? 1
                                    : (daysLeft / totalDays).clamp(0.02, 1),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: expired
                                        ? AppColors.danger
                                        : AppColors.memberB,
                                    borderRadius: BorderRadius.circular(9),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _StatCell(
                            value: '${m.visitsThisMonth}',
                            label: 'Visits/mo',
                          ),
                          _StatCell(
                            value: _relativeVisit(m.lastCheckInAt),
                            label: 'Last visit',
                          ),
                          _StatCell(value: m.branch.name, label: 'Branch'),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _ActionButton(
                      icon: Icons.call_rounded,
                      label: 'Call',
                      color: AppColors.staffA,
                      onTap: hasPhone
                          ? () => _open(Uri(scheme: 'tel', path: m.phone))
                          : null,
                    ),
                    _ActionButton(
                      icon: Icons.chat_rounded,
                      label: 'WhatsApp',
                      color: AppColors.success,
                      onTap: hasPhone
                          ? () => _open(
                                Uri.parse(
                                  'https://wa.me/${_waNumber(m.phone!)}',
                                ),
                              )
                          : null,
                    ),
                    if (!deleted && membership != null)
                      _ActionButton(
                        icon: Icons.autorenew_rounded,
                        label: _renewing ? '…' : 'Renew',
                        color: AppColors.staffB,
                        onTap: _renewing ? null : _renew,
                      ),
                    if (!deleted) ...[
                      const SizedBox(width: 6),
                      Expanded(
                        flex: 2,
                        child: _PunchInButton(
                          loading: _checkingIn,
                          onTap: _checkingIn ? null : _punchIn,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoCell extends StatelessWidget {
  const _InfoCell({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 15, color: AppColors.inkFaint),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppText.body(size: 10, color: AppColors.inkFaint),
                ),
                const SizedBox(height: 1),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w700,
                    color: valueColor ?? AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppText.body(size: 12, weight: FontWeight.w800),
            ),
            Text(
              label,
              textAlign: TextAlign.center,
              style: AppText.body(size: 9.5, color: AppColors.inkFaint),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Opacity(
          opacity: enabled ? 1 : 0.35,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 17, color: color),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: AppText.body(size: 11, weight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PunchInButton extends StatelessWidget {
  const _PunchInButton({required this.loading, required this.onTap});

  final bool loading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Ink(
          height: 40,
          decoration: BoxDecoration(
            gradient: AppColors.memberGrad,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.memberOnGrad,
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.fingerprint_rounded,
                        size: 17,
                        color: AppColors.memberOnGrad,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Punch In',
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w800,
                          color: AppColors.memberOnGrad,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

/// Gradient header — the shared fixed-height [ListHero] used by every list.
class _MembersHero extends StatelessWidget {
  const _MembersHero({required this.stats});

  final MemberStats? stats;

  @override
  Widget build(BuildContext context) {
    final s = stats;
    return BlocBuilder<PaginatedListCubit<GymMember>,
        PaginatedListState<GymMember>>(
      builder: (context, state) {
        final shown = state is PaginatedListLoaded<GymMember>
            ? '${state.items.length} shown'
            : '';
        return ListHero(
          title: 'Members',
          subtitle: [
            if (s != null) '${s.total} total',
            if (shown.isNotEmpty) shown,
          ].join(' · '),
          leading: ListHeroButton(
            icon: Icons.menu_rounded,
            onTap: () => SlideDrawerController.of(context)?.open(),
          ),
          trailing: [
            ListHeroButton(
              icon: Icons.add_rounded,
              onTap: () => context.push(AppRoutes.memberForm).then((_) {
                if (context.mounted) {
                  context.read<PaginatedListCubit<GymMember>>().load();
                }
              }),
            ),
          ],
          chips: [
            if (s != null) ...[
              ListHeroChip(
                icon: Icons.check_circle_rounded,
                label: '${s.byStatus.active} active',
              ),
              ListHeroChip(
                icon: Icons.ac_unit_rounded,
                label: '${s.byStatus.frozen} frozen',
              ),
              ListHeroChip(
                icon: Icons.pause_circle_rounded,
                label: '${s.byStatus.inactive} inactive',
              ),
              ListHeroChip(
                icon: Icons.person_add_alt_1_rounded,
                label: '${s.newThisMonth} new this month',
              ),
            ],
          ],
        );
      },
    );
  }
}

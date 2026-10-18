import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/workout_plan.dart';
import '../../../models/workout_plan_summary.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../plans/presentation/plan_ui.dart' show PlanAvatar, PlanHeroChip;
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'workout_actions.dart';
import 'workout_ui.dart';
import 'widgets/workout_plan_card.dart';

const _sorts = [
  ('createdAt:desc', 'Newest first'),
  ('createdAt:asc', 'Oldest first'),
  ('name:asc', 'Name (A-Z)'),
  ('name:desc', 'Name (Z-A)'),
  ('durationWeeks:asc', 'Duration (short to long)'),
  ('durationWeeks:desc', 'Duration (long to short)'),
];

const _statusFilters = [
  (label: 'All', value: ''),
  (label: 'Active', value: 'active'),
  (label: 'Inactive', value: 'inactive'),
];

/// Pure filtering + sorting of a plan list (shared by the Owner / Manager
/// catalog and the Trainer's picker, and unit-tested): [status] is `''`,
/// `active`, `inactive` or `deleted`; [level] a `BEGINNER`-style value or `''`.
List<WorkoutPlanSummary> filterWorkoutPlans(
  List<WorkoutPlanSummary> all, {
  String search = '',
  String status = '',
  String level = '',
  String sort = 'createdAt:desc',
}) {
  final q = search.trim().toLowerCase();
  final list = all.where((p) {
    switch (status) {
      case 'active':
        if (p.isDeleted || !p.isActive) return false;
      case 'inactive':
        if (p.isDeleted || p.isActive) return false;
      case 'deleted':
        if (!p.isDeleted) return false;
    }
    if (level.isNotEmpty && p.level != level) return false;
    if (q.isEmpty) return true;
    return [p.name, p.goal]
        .any((v) => v != null && v.toLowerCase().contains(q));
  }).toList();
  final parts = sort.split(':');
  final dir = parts[1] == 'desc' ? -1 : 1;
  int cmp(WorkoutPlanSummary a, WorkoutPlanSummary b) {
    switch (parts[0]) {
      case 'name':
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      case 'durationWeeks':
        return a.durationWeeks.compareTo(b.durationWeeks);
      default:
        final x = a.createdAt, y = b.createdAt;
        if (x == null && y == null) return 0;
        if (x == null) return -1;
        if (y == null) return 1;
        return x.compareTo(y);
    }
  }

  list.sort((a, b) => dir * cmp(a, b));
  return list;
}

/// Workout Plans catalog (Owner / Manager / Receptionist / Trainer menu ->
/// Programs -> Workout Plans), brought to parity with web's `/workout-plans`
/// page and the Members / Leads / Team / Branches / Membership Plans design
/// language: gradient [ListHero], KPI tiles and insight panels that open
/// bottom sheets, search + status chips + level / trainer / sort + cards /
/// compact toggle, rich plan cards (level, duration, members, trainer and the
/// Mon-Sun strip with each day's exercise count) with a lifecycle menu
/// (duplicate, activate / deactivate, delete, restore) and New plan.
///
/// Every plan (soft-deleted included, as web does) is loaded once through
/// [WorkoutPlanRepository.listAll]; search, filters, sorting and each count
/// are computed on the device. That keeps the KPIs independent of the filters
/// and sidesteps the API's `isActive=false` coercion bug. It is a pushed
/// route, so it reloads on every visit and after every change made from it.
/// The card's exercise strip is fetched lazily per visible card
/// (`GET /workout-plans/:id`), since the list DTO has no exercises.
///
/// Controls follow web's permissions: New plan + Duplicate
/// (`workouts:create`), Edit + Activate / Deactivate (`workouts:update`),
/// Delete (`workouts:delete`), Restore (`workouts:restore`). The menu entry
/// that opens this screen (`workouts:view` + feature flag `workout_plans`) is
/// unchanged.
///
/// **Dropped vs. web**: the Exercise-library shortcut (a separate catalog with
/// its own screens) and a "members on this plan" list (no endpoint lists a
/// plan's members; only the active-member count exists).
class WorkoutPlansScreen extends StatefulWidget {
  const WorkoutPlansScreen({super.key});

  @override
  State<WorkoutPlansScreen> createState() => _WorkoutPlansScreenState();
}

class _WorkoutPlansScreenState extends State<WorkoutPlansScreen> {
  List<WorkoutPlanSummary>? _all;
  bool _loading = true;
  String? _error;

  String _search = '';
  String _status = '';
  String _level = '';
  String _sort = 'createdAt:desc';
  bool _compact = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final all = await getIt<WorkoutPlanRepository>().listAll();
      if (!mounted) return;
      setState(() {
        _all = all;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load workout plans ($e)');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_all != null) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  // ── derived data ──────────────────────────────────────────────────────────

  List<WorkoutPlanSummary> get _live => (_all ?? const <WorkoutPlanSummary>[])
      .where((p) => !p.isDeleted)
      .toList();

  List<WorkoutPlanSummary> get _visible => filterWorkoutPlans(
        _all ?? const [],
        search: _search,
        status: _status,
        level: _level,
        sort: _sort,
      );

  int _countFor(String status) {
    final all = _all ?? const <WorkoutPlanSummary>[];
    final live = _live;
    return switch (status) {
      'active' => live.where((p) => p.isActive).length,
      'inactive' => live.where((p) => !p.isActive).length,
      'deleted' => all.length - live.length,
      _ => all.length,
    };
  }

  bool get _hasFilters =>
      _search.isNotEmpty || _status.isNotEmpty || _level.isNotEmpty;

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _open(WorkoutPlanSummary p) async {
    if (p.isDeleted) {
      _openDeletedSheet(p);
      return;
    }
    await _openId(p.id);
  }

  /// Opens a plan's detail; when Duplicate was used there it pops with the
  /// new draft's id, which is opened in turn.
  Future<void> _openId(String id) async {
    final next = await context.push<String>(
      AppRoutes.workoutPlanDetail,
      extra: id,
    );
    if (!mounted) return;
    await _load(silent: true);
    if (next != null && mounted) await _openId(next);
  }

  Future<void> _add() async {
    final id = await context.push<String>(AppRoutes.workoutPlanForm);
    if (!mounted) return;
    await _load(silent: true);
    if (id != null && mounted) await _openId(id);
  }

  Future<void> _menu(WorkoutPlanSummary p, String value) async {
    switch (value) {
      case 'view':
        await _open(p);
      default:
        final action = WorkoutAction.values.firstWhere((a) => a.name == value);
        final r = await runWorkoutAction(
          context,
          planId: p.id,
          planName: p.name,
          action: action,
        );
        if (r.ok && mounted) _load(silent: true);
    }
  }

  void _setStatus(String s) => setState(() => _status = s);

  Future<void> _pickSort() async {
    final v = await pickOneSheet(
      context,
      title: 'Sort by',
      options: [for (final s in _sorts) (s.$1, s.$2)],
      current: _sort,
    );
    if (v == null || v.isEmpty) return;
    setState(() => _sort = v);
  }

  Future<void> _pickLevel() async {
    final v = await pickOneSheet(
      context,
      title: 'Level',
      options: [for (final l in WorkoutLevel.values) (l.apiValue, l.label)],
      current: _level.isEmpty ? null : _level,
      clearLabel: 'All levels',
    );
    if (v == null) return;
    setState(() => _level = v);
  }

  // ── sheets ────────────────────────────────────────────────────────────────

  void _openDeletedSheet(WorkoutPlanSummary p) {
    final canRestore = teamCan(context, 'workouts:restore');
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: Icons.delete_outline_rounded,
        title: p.name,
        subtitle: 'Deleted ${fmtDate(p.deletedAt)}',
        color: TeamColors.rose,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TeamTileGrid(
              tiles: [
                TeamFieldTile(
                  icon: Icons.signal_cellular_alt_rounded,
                  label: 'Level',
                  value: p.levelValue.label,
                  color: levelColor(p.levelValue),
                ),
                TeamFieldTile(
                  icon: Icons.timelapse_rounded,
                  label: 'Duration',
                  value: weeksLabel(p.durationWeeks),
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.sports_gymnastics_rounded,
                  label: 'Trainer',
                  value: p.trainerName,
                  color: TeamColors.violet,
                ),
                TeamFieldTile(
                  icon: Icons.track_changes_rounded,
                  label: 'Goal',
                  value: p.goal,
                  color: TeamColors.amber,
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (canRestore)
              TeamGradientButton(
                label: 'Restore plan',
                icon: Icons.restore_from_trash_rounded,
                gradient: TeamColors.ctaGreen,
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  final r = await runWorkoutAction(
                    context,
                    planId: p.id,
                    planName: p.name,
                    action: WorkoutAction.restore,
                  );
                  if (r.ok && mounted) _load(silent: true);
                },
              )
            else
              Text(
                'You do not have permission to restore plans.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              ),
          ],
        ),
      ),
    );
  }

  /// A plan-per-row sheet. [trailing] gives the right-hand text; when
  /// [filter] is set a button applies it to the main list.
  void _openPlansSheet({
    required String title,
    required IconData icon,
    required Color color,
    required List<WorkoutPlanSummary> rows,
    String Function(WorkoutPlanSummary p)? trailing,
    String? filter,
    String? subtitle,
  }) {
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: icon,
        title: title,
        subtitle:
            subtitle ?? '${rows.length} ${rows.length == 1 ? 'plan' : 'plans'}',
        color: color,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (filter != null)
              GestureDetector(
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _setStatus(filter);
                },
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
                      Text(
                        filter.isEmpty
                            ? 'Show everything in the main list'
                            : 'Filter the main list',
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w800,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  'Nothing here right now.',
                  style: AppText.body(size: 13, color: AppColors.inkFaint),
                ),
              )
            else
              for (final p in rows)
                _PlanRow(
                  plan: p,
                  trailing: trailing?.call(p),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _open(p);
                  },
                ),
          ],
        ),
      ),
    );
  }

  // ── KPIs + insights ───────────────────────────────────────────────────────

  List<TeamKpi> _kpis() {
    final live = _live;
    return [
      TeamKpi(
        label: 'Total plans',
        value: live.length,
        color: TeamColors.indigo,
        icon: Icons.fitness_center_rounded,
        active: _status.isEmpty,
      ),
      TeamKpi(
        label: 'Active',
        value: live.where((p) => p.isActive).length,
        color: TeamColors.green,
        icon: Icons.check_circle_rounded,
        active: _status == 'active',
      ),
      TeamKpi(
        label: 'Inactive',
        value: live.where((p) => !p.isActive).length,
        color: TeamColors.amber,
        icon: Icons.pause_circle_rounded,
        active: _status == 'inactive',
      ),
      TeamKpi(
        label: 'Members assigned',
        value: live.fold(0, (a, p) => a + p.activeMemberCount),
        color: TeamColors.violet,
        icon: Icons.groups_rounded,
      ),
    ];
  }

  void _onKpi(int i) {
    final live = _live;
    switch (i) {
      case 0:
        _openPlansSheet(
          title: 'Total plans',
          icon: Icons.fitness_center_rounded,
          color: TeamColors.indigo,
          rows: live,
          filter: '',
          trailing: (p) => weeksLabel(p.durationWeeks),
        );
      case 1:
        _openPlansSheet(
          title: 'Active',
          icon: Icons.check_circle_rounded,
          color: TeamColors.green,
          rows: live.where((p) => p.isActive).toList(),
          filter: 'active',
          trailing: (p) => weeksLabel(p.durationWeeks),
        );
      case 2:
        _openPlansSheet(
          title: 'Inactive',
          icon: Icons.pause_circle_rounded,
          color: TeamColors.amber,
          rows: live.where((p) => !p.isActive).toList(),
          filter: 'inactive',
          trailing: (p) => weeksLabel(p.durationWeeks),
        );
      default:
        _openPlansSheet(
          title: 'Members assigned',
          icon: Icons.groups_rounded,
          color: TeamColors.violet,
          rows: ([...live]
            ..sort((a, b) => b.activeMemberCount - a.activeMemberCount)),
          trailing: (p) => '${p.activeMemberCount} members',
        );
    }
  }

  Widget _insights() {
    final live = _live;
    final active = live.where((p) => p.isActive).length;
    final inactive = live.length - active;
    final deleted = (_all ?? const <WorkoutPlanSummary>[]).length - live.length;

    final levelRows = <(String, int)>[
      for (final l in WorkoutLevel.values)
        (l.label, live.where((p) => p.levelValue == l).length),
    ].where((r) => r.$2 > 0).toList();

    final trainerCounts = <String, int>{};
    for (final p in live) {
      final key = p.trainerName ?? 'Unassigned';
      trainerCounts[key] = (trainerCounts[key] ?? 0) + 1;
    }
    final byTrainer = trainerCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return TeamAdaptive(
      children: [
        TeamInsightCard(
          icon: Icons.donut_large_rounded,
          title: 'Status mix',
          color: TeamColors.indigo,
          trailing: '${live.length} plans',
          onTap: () => _openPlansSheet(
            title: 'Status mix',
            icon: Icons.donut_large_rounded,
            color: TeamColors.indigo,
            rows: live,
            filter: '',
            trailing: (p) =>
                workoutStatus(deleted: p.isDeleted, active: p.isActive),
          ),
          child: DonutChart(
            size: 84,
            slices: [
              if (active > 0)
                DonutSlice(
                  label: 'Active',
                  value: active,
                  color: TeamColors.green,
                ),
              if (inactive > 0)
                DonutSlice(
                  label: 'Inactive',
                  value: inactive,
                  color: TeamColors.amber,
                ),
              if (deleted > 0)
                DonutSlice(
                  label: 'Deleted',
                  value: deleted,
                  color: TeamColors.rose,
                ),
            ],
          ),
        ),
        TeamInsightCard(
          icon: Icons.signal_cellular_alt_rounded,
          title: 'By level',
          color: TeamColors.teal,
          onTap: levelRows.isEmpty
              ? null
              : () => _openPlansSheet(
                    title: 'By level',
                    icon: Icons.signal_cellular_alt_rounded,
                    color: TeamColors.teal,
                    rows: ([...live]..sort(
                        (a, b) =>
                            a.levelValue.index.compareTo(b.levelValue.index),
                      )),
                    trailing: (p) => p.levelValue.label,
                  ),
          child: TeamBarRows(
            rows: levelRows,
            colors: const [TeamColors.teal, TeamColors.green],
          ),
        ),
        TeamInsightCard(
          icon: Icons.sports_gymnastics_rounded,
          title: 'By trainer',
          color: TeamColors.violet,
          onTap: live.isEmpty
              ? null
              : () => _openPlansSheet(
                    title: 'By trainer',
                    icon: Icons.sports_gymnastics_rounded,
                    color: TeamColors.violet,
                    rows: ([...live]..sort(
                        (a, b) => (a.trainerName ?? '~').compareTo(
                          b.trainerName ?? '~',
                        ),
                      )),
                    trailing: (p) => p.trainerName ?? 'Unassigned',
                  ),
          child: TeamBarRows(
            rows: [for (final e in byTrainer.take(6)) (e.key, e.value)],
            colors: const [TeamColors.violet, TeamColors.indigo],
          ),
        ),
      ],
    );
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final canCreate = teamCan(context, 'workouts:create');
    final canUpdate = teamCan(context, 'workouts:update');
    final canDelete = teamCan(context, 'workouts:delete');
    final canRestore = teamCan(context, 'workouts:restore');

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top, canCreate)),
            if (_all != null)
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TeamKpiGrid(
                          tiles: _kpis(),
                          loading: false,
                          onTap: _onKpi,
                        ),
                        if (_live.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          _insights(),
                        ],
                        const SizedBox(height: 14),
                        _toolbar(),
                      ],
                    ),
                  ),
                ),
              ),
            ..._body(
              canCreate: canCreate,
              canUpdate: canUpdate,
              canDelete: canDelete,
              canRestore: canRestore,
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _body({
    required bool canCreate,
    required bool canUpdate,
    required bool canDelete,
    required bool canRestore,
  }) {
    if (_loading && _all == null) {
      return const [
        SliverFillRemaining(hasScrollBody: false, child: AppLoadingView()),
      ];
    }
    if (_error != null && _all == null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppErrorView(message: _error!, onRetry: _load),
        ),
      ];
    }
    final items = _visible;
    if (items.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppEmptyState(
            icon: Icons.fitness_center_outlined,
            title: _hasFilters
                ? 'No workout plans match these filters'
                : 'No workout plans yet',
            message: _hasFilters
                ? 'Try clearing a filter or the search.'
                : canCreate
                    ? 'Create your first workout plan to get started.'
                    : 'Nothing to show yet.',
          ),
        ),
      ];
    }
    return [
      teamCardSliver<WorkoutPlanSummary>(
        context,
        items: items,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (p, i) => _Rise(
          index: i,
          child: WorkoutPlanCard(
            key: ValueKey('plan-${p.id}'),
            plan: p,
            compact: _compact,
            actions: availableWorkoutActions(
              deleted: p.isDeleted,
              active: p.isActive,
              canCreate: canCreate,
              canUpdate: canUpdate,
              canDelete: canDelete,
              canRestore: canRestore,
            ),
            onTap: () => _open(p),
            onMenu: (v) => _menu(p, v),
          ),
        ),
      ),
    ];
  }

  Widget _toolbar() {
    final sortLabel = _sorts.firstWhere((s) => s.$1 == _sort).$2;
    final levelLabel =
        _level.isEmpty ? 'Any level' : WorkoutLevelX.fromApi(_level).label;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSearchField(
          hint: 'Search name or goal…',
          onSearch: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TeamToolbarButton(
                icon: Icons.sort_rounded,
                label: sortLabel,
                onTap: _pickSort,
              ),
            ),
            const SizedBox(width: 8),
            _ViewToggle(
              compact: _compact,
              onChanged: (v) => setState(() => _compact = v),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TeamToolbarButton(
                icon: Icons.signal_cellular_alt_rounded,
                label: levelLabel,
                active: _level.isNotEmpty,
                onTap: _pickLevel,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _hero(double top, bool canCreate) {
    final all = _all;
    final live = _live;
    final deleted = all == null ? 0 : all.length - live.length;
    final members = live.fold(0, (a, p) => a + p.activeMemberCount);
    final active = live.where((p) => p.isActive).length;
    return ListHero(
      title: 'Workout Plans',
      subtitle: all == null
          ? 'Plans, exercises and member progress.'
          : '${live.length} ${live.length == 1 ? 'plan' : 'plans'}'
              ' · $active active'
              '${deleted > 0 ? ' · $deleted deleted' : ''}'
              ' · $members members',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        if (canCreate) ListHeroButton(icon: Icons.add_rounded, onTap: _add),
      ],
      chips: [
        for (final f in _statusFilters)
          PlanHeroChip(
            label: '${f.label} · ${_countFor(f.value)}',
            selected: _status == f.value,
            onTap: () => _setStatus(f.value),
          ),
      ],
    );
  }
}

/// Cards / compact switch (web's grid / list toggle).
class _ViewToggle extends StatelessWidget {
  const _ViewToggle({required this.compact, required this.onChanged});

  final bool compact;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget btn(IconData icon, String tip, bool on, bool value) => Tooltip(
          message: tip,
          child: GestureDetector(
            onTap: () => onChanged(value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: on ? TeamColors.cta : null,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                size: 19,
                color: on ? Colors.white : AppColors.inkFaint,
              ),
            ),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          btn(Icons.grid_view_rounded, 'Cards', !compact, false),
          btn(Icons.view_list_rounded, 'Compact list', compact, true),
        ],
      ),
    );
  }
}

/// Rises into place; capped delay so rows far down the list don't wait.
class _Rise extends StatelessWidget {
  const _Rise({required this.index, required this.child});

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

/// A plan line inside the KPI / insight sheets.
class _PlanRow extends StatelessWidget {
  const _PlanRow({required this.plan, required this.onTap, this.trailing});

  final WorkoutPlanSummary plan;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = plan;
    final tone = workoutTone(deleted: p.isDeleted, active: p.isActive);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 2),
          child: Row(
            children: [
              PlanAvatar(name: p.name, color: tone, size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                    Text(
                      [
                        p.levelValue.label,
                        if (p.trainerName != null) p.trainerName!,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null)
                Text(
                  trailing!,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: tone,
                  ),
                ),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

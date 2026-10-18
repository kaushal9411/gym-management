import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan_summary.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../plans/presentation/plan_ui.dart' show PlanAvatar, PlanHeroChip;
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'diet_actions.dart';
import 'diet_ui.dart';
import 'widgets/diet_plan_card.dart';

const _sorts = [
  ('createdAt:desc', 'Newest first'),
  ('createdAt:asc', 'Oldest first'),
  ('name:asc', 'Name (A-Z)'),
  ('name:desc', 'Name (Z-A)'),
  ('durationDays:asc', 'Duration (short to long)'),
  ('durationDays:desc', 'Duration (long to short)'),
];

const _statusFilters = [
  (label: 'All', value: ''),
  (label: 'Active', value: 'active'),
  (label: 'Inactive', value: 'inactive'),
];

/// Pure filtering + sorting of a plan list (shared by the Owner / Manager
/// catalog and the Trainer's picker, and unit-tested): [status] is `''`,
/// `active` or `inactive` (`''` keeps soft-deleted plans too, like web's
/// "All"). [searchIds], when given, are the ids the server matched for the
/// search text (web searches name, goal **and description**; the list DTO has
/// no description, so the server decides) and replace the local match.
List<DietPlanSummary> filterDietPlans(
  List<DietPlanSummary> all, {
  String search = '',
  String status = '',
  String sort = 'createdAt:desc',
  Set<String>? searchIds,
}) {
  final q = search.trim().toLowerCase();
  final list = all.where((p) {
    switch (status) {
      case 'active':
        if (p.isDeleted || !p.isActive) return false;
      case 'inactive':
        if (p.isDeleted || p.isActive) return false;
    }
    if (q.isEmpty) return true;
    if (searchIds != null) return searchIds.contains(p.id);
    return [p.name, p.goal]
        .any((v) => v != null && v.toLowerCase().contains(q));
  }).toList();
  final parts = sort.split(':');
  final dir = parts[1] == 'desc' ? -1 : 1;
  int cmp(DietPlanSummary a, DietPlanSummary b) {
    switch (parts[0]) {
      case 'name':
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      case 'durationDays':
        return a.durationDays.compareTo(b.durationDays);
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

/// Diet Plans catalog (Owner / Manager / Receptionist / Trainer menu ->
/// Programs -> Diet Plans), brought to parity with web's `/diet-plans` page
/// and the Members / Leads / Team / Branches / Membership + Workout Plans
/// design language: gradient [ListHero], KPI tiles and insight panels that
/// open bottom sheets, search + sort + cards / compact toggle, rich plan
/// cards (duration, kcal, goal, members, trainer) with a lifecycle menu
/// (duplicate, activate / deactivate, delete, restore), New plan and Smart
/// Diet Plan.
///
/// Every plan (soft-deleted included, as web does) is loaded once through
/// [DietPlanRepository.listAll]; filters, sorting and each count are computed
/// on the device. That keeps the KPIs independent of the filters and
/// sidesteps the API's `isActive=false` coercion bug. Search asks the server
/// for matching ids (web's search also covers the description) and falls back
/// to name + goal on the device. It is a pushed route, so it reloads on every
/// visit and after every change made from it.
///
/// Controls follow web's permissions: New plan, Smart Diet Plan and Duplicate
/// (`diets:create`), Activate / Deactivate (`diets:update`), Delete
/// (`diets:delete`), Restore (`diets:restore`). The menu entry that opens this
/// screen (`diets:view` + feature flag `diet_plans`) is unchanged.
///
/// **Dropped vs. web**: the Food library shortcut (a separate catalog that
/// the Owner / Manager menus have no entry for) and a "members on this plan"
/// list (no endpoint lists a plan's members; only the count exists).
class DietPlansScreen extends StatefulWidget {
  const DietPlansScreen({super.key});

  @override
  State<DietPlansScreen> createState() => _DietPlansScreenState();
}

class _DietPlansScreenState extends State<DietPlansScreen> {
  List<DietPlanSummary>? _all;
  bool _loading = true;
  String? _error;

  String _search = '';
  Set<String>? _searchIds;
  int _searchToken = 0;
  String _status = '';
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
      final all = await getIt<DietPlanRepository>().listAll();
      if (!mounted) return;
      setState(() {
        _all = all;
        _loading = false;
        _error = null;
      });
      if (_search.isNotEmpty) _runSearch(_search);
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load diet plans ($e)');
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

  /// Web's search also matches the description, which the list DTO lacks:
  /// ask the server which plans match and filter by those ids. Any failure
  /// just leaves the on-device name + goal match in place.
  Future<void> _runSearch(String q) async {
    final token = ++_searchToken;
    try {
      final r = await getIt<DietPlanRepository>().list(
        search: q,
        limit: 100,
        includeDeleted: true,
      );
      if (!mounted || token != _searchToken) return;
      setState(() => _searchIds = {for (final p in r.items) p.id});
    } catch (_) {
      if (!mounted || token != _searchToken) return;
      setState(() => _searchIds = null);
    }
  }

  void _onSearch(String v) {
    setState(() {
      _search = v;
      _searchIds = null;
    });
    _searchToken++;
    if (v.isNotEmpty) _runSearch(v);
  }

  // ── derived data ──────────────────────────────────────────────────────────

  List<DietPlanSummary> get _live =>
      (_all ?? const <DietPlanSummary>[]).where((p) => !p.isDeleted).toList();

  List<DietPlanSummary> get _visible => filterDietPlans(
        _all ?? const [],
        search: _search,
        status: _status,
        sort: _sort,
        searchIds: _searchIds,
      );

  int _countFor(String status) {
    final all = _all ?? const <DietPlanSummary>[];
    final live = _live;
    return switch (status) {
      'active' => live.where((p) => p.isActive).length,
      'inactive' => live.where((p) => !p.isActive).length,
      _ => all.length,
    };
  }

  bool get _hasFilters => _search.isNotEmpty || _status.isNotEmpty;

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _open(DietPlanSummary p) async {
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
      AppRoutes.dietPlanDetail,
      extra: id,
    );
    if (!mounted) return;
    await _load(silent: true);
    if (next != null && mounted) await _openId(next);
  }

  Future<void> _add() async {
    final id = await context.push<String>(AppRoutes.dietPlanForm);
    if (!mounted) return;
    await _load(silent: true);
    if (id != null && mounted) await _openId(id);
  }

  Future<void> _smart() async {
    final id = await context.push<String>(AppRoutes.smartDietPlan);
    if (!mounted) return;
    await _load(silent: true);
    if (id != null && mounted) await _openId(id);
  }

  Future<void> _menu(DietPlanSummary p, String value) async {
    switch (value) {
      case 'view':
        await _open(p);
      default:
        final action = DietAction.values.firstWhere((a) => a.name == value);
        final r = await runDietAction(
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

  // ── sheets ────────────────────────────────────────────────────────────────

  void _openDeletedSheet(DietPlanSummary p) {
    final canRestore = teamCan(context, 'diets:restore');
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
                  icon: Icons.timelapse_rounded,
                  label: 'Duration',
                  value: daysLabel(p.durationDays),
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.local_fire_department_rounded,
                  label: 'Daily calories',
                  value: p.dailyCalories == null
                      ? null
                      : kcalLabel(p.dailyCalories),
                  color: TeamColors.amber,
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
                  color: TeamColors.indigo,
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
                  final r = await runDietAction(
                    context,
                    planId: p.id,
                    planName: p.name,
                    action: DietAction.restore,
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
    required List<DietPlanSummary> rows,
    String Function(DietPlanSummary p)? trailing,
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
        icon: Icons.restaurant_rounded,
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
    String days(DietPlanSummary p) => daysLabel(p.durationDays);
    switch (i) {
      case 0:
        _openPlansSheet(
          title: 'Total plans',
          icon: Icons.restaurant_rounded,
          color: TeamColors.indigo,
          rows: live,
          filter: '',
          trailing: days,
        );
      case 1:
        _openPlansSheet(
          title: 'Active',
          icon: Icons.check_circle_rounded,
          color: TeamColors.green,
          rows: live.where((p) => p.isActive).toList(),
          filter: 'active',
          trailing: days,
        );
      case 2:
        _openPlansSheet(
          title: 'Inactive',
          icon: Icons.pause_circle_rounded,
          color: TeamColors.amber,
          rows: live.where((p) => !p.isActive).toList(),
          filter: 'inactive',
          trailing: days,
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

  static String _goalKey(DietPlanSummary p) {
    final g = p.goal?.trim() ?? '';
    return g.isEmpty ? 'No goal set' : g;
  }

  Widget _insights() {
    final live = _live;
    final active = live.where((p) => p.isActive).length;
    final inactive = live.length - active;

    final goalCounts = <String, int>{};
    for (final p in live) {
      goalCounts[_goalKey(p)] = (goalCounts[_goalKey(p)] ?? 0) + 1;
    }
    final byGoal = goalCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

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
                dietStatus(deleted: p.isDeleted, active: p.isActive),
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
            ],
          ),
        ),
        TeamInsightCard(
          icon: Icons.track_changes_rounded,
          title: 'By goal',
          color: TeamColors.teal,
          onTap: live.isEmpty
              ? null
              : () => _openPlansSheet(
                    title: 'By goal',
                    icon: Icons.track_changes_rounded,
                    color: TeamColors.teal,
                    rows: ([...live]
                      ..sort((a, b) => _goalKey(a).compareTo(_goalKey(b)))),
                    trailing: _goalKey,
                  ),
          child: TeamBarRows(
            rows: [for (final e in byGoal.take(6)) (e.key, e.value)],
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
    final canCreate = teamCan(context, 'diets:create');
    final canUpdate = teamCan(context, 'diets:update');
    final canDelete = teamCan(context, 'diets:delete');
    final canRestore = teamCan(context, 'diets:restore');

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
            icon: Icons.restaurant_outlined,
            title: _hasFilters
                ? 'No diet plans match these filters'
                : 'No diet plans yet',
            message: _hasFilters
                ? 'Try clearing a filter or the search.'
                : canCreate
                    ? 'Create your first diet plan to get started.'
                    : 'Nothing to show yet.',
          ),
        ),
      ];
    }
    return [
      teamCardSliver<DietPlanSummary>(
        context,
        items: items,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (p, i) => _Rise(
          index: i,
          child: DietPlanCard(
            key: ValueKey('plan-${p.id}'),
            plan: p,
            compact: _compact,
            actions: availableDietActions(
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSearchField(
          hint: 'Search name, goal, description…',
          onSearch: _onSearch,
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
      title: 'Diet Plans',
      subtitle: all == null
          ? 'Meal plans, nutrition templates and member diets.'
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
        if (canCreate)
          ListHeroButton(icon: Icons.auto_awesome_rounded, onTap: _smart),
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

  final DietPlanSummary plan;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = plan;
    final tone = dietTone(deleted: p.isDeleted, active: p.isActive);
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
                        if (p.dailyCalories != null) '${p.dailyCalories} kcal',
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
                Flexible(
                  child: Text(
                    trailing!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: tone,
                    ),
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

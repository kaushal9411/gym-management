import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'plan_actions.dart';
import 'plan_ui.dart';
import 'widgets/plan_card.dart';

const _sorts = [
  ('displayOrder:asc', 'Display order'),
  ('name:asc', 'Name (A-Z)'),
  ('name:desc', 'Name (Z-A)'),
  ('price:asc', 'Price (low to high)'),
  ('price:desc', 'Price (high to low)'),
  ('createdAt:desc', 'Newest first'),
  ('createdAt:asc', 'Oldest first'),
];

const _statusFilters = [
  (label: 'All', value: ''),
  (label: 'Active', value: 'active'),
  (label: 'Inactive', value: 'inactive'),
  (label: 'Deleted', value: 'deleted'),
];

/// Membership Plans list, brought to parity with web's `/memberships` page
/// and the Members / Leads / Team / Branches design language: gradient
/// [ListHero], KPI tiles and insight panels that open bottom sheets, search +
/// status chips + category / branch / sort + cards / compact toggle, rich
/// plan cards (animated price with its discount / tax breakdown, ✓ / ✗ perk
/// checklist, member count) with a lifecycle menu (duplicate, activate /
/// deactivate, delete, restore) and New plan.
///
/// All plans (soft-deleted included, as web does) are loaded once through
/// [MembershipPlanRepository.listAll]; search, every filter, sorting and each
/// count are computed on the device. That keeps the KPIs unaffected by the
/// filters (like web's second unfiltered query) and sidesteps the API's
/// `isActive=false` coercion bug (see the repository). It is a pushed route,
/// so it reloads on every visit and after every change made from it.
///
/// **Dropped vs. web**: nothing with an endpoint. Web's header branch switch
/// has no mobile equivalent, so a Branch filter button (plans valid at a
/// branch: "all branches" or listing it) takes its place. There is no
/// "members on this plan" list: the member list endpoint can't filter by
/// plan, so only the count (`memberCount`, ACTIVE memberships) is shown.
class MembershipPlansScreen extends StatefulWidget {
  const MembershipPlansScreen({super.key});

  @override
  State<MembershipPlansScreen> createState() => _MembershipPlansScreenState();
}

class _MembershipPlansScreenState extends State<MembershipPlansScreen> {
  List<MembershipPlan>? _all;
  List<BranchOption> _branches = const [];
  bool _loading = true;
  String? _error;

  String _search = '';
  String _status = '';
  String _category = '';
  String _branch = '';
  String _sort = 'displayOrder:asc';
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
      final all = await getIt<MembershipPlanRepository>().listAll();
      if (!mounted) return;
      setState(() {
        _all = all;
        _loading = false;
        _error = null;
      });
      _loadBranches();
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load membership plans ($e)');
    }
  }

  /// Branch names for the access line + the Branch filter. Needs
  /// `branches:view`; without it the plans still work (counts only).
  Future<void> _loadBranches() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (mounted) setState(() => _branches = b);
    } catch (_) {
      // Optional garnish — never block the list on it.
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

  Map<String, String> get _branchNames => {
        for (final b in _branches) b.id: b.name,
      };

  // ── derived data ──────────────────────────────────────────────────────────

  List<MembershipPlan> get _live =>
      (_all ?? const <MembershipPlan>[]).where((p) => !p.isDeleted).toList();

  List<String> get _categories {
    final set = <String>{
      for (final p in _live)
        if (p.category != null) p.category!,
    }.toList()
      ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
    return set;
  }

  bool _atBranch(MembershipPlan p, String id) =>
      p.gymAccessAllBranches || p.accessBranchIds.contains(id);

  List<MembershipPlan> get _visible {
    final q = _search.toLowerCase();
    final list = (_all ?? const <MembershipPlan>[]).where((p) {
      switch (_status) {
        case 'active':
          if (p.isDeleted || !p.isActive) return false;
        case 'inactive':
          if (p.isDeleted || p.isActive) return false;
        case 'deleted':
          if (!p.isDeleted) return false;
      }
      if (_category.isNotEmpty &&
          (p.category ?? '').toLowerCase() != _category.toLowerCase()) {
        return false;
      }
      if (_branch.isNotEmpty && !_atBranch(p, _branch)) return false;
      if (q.isEmpty) return true;
      return [p.name, p.planCode, p.description, p.category]
          .any((v) => v != null && v.toLowerCase().contains(q));
    }).toList();
    final parts = _sort.split(':');
    final dir = parts[1] == 'desc' ? -1 : 1;
    int cmp(MembershipPlan a, MembershipPlan b) {
      switch (parts[0]) {
        case 'price':
          return a.price.compareTo(b.price);
        case 'createdAt':
          final x = a.createdAt, y = b.createdAt;
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          return x.compareTo(y);
        case 'name':
          return a.name.toLowerCase().compareTo(b.name.toLowerCase());
        default:
          final c = a.displayOrder.compareTo(b.displayOrder);
          return c != 0
              ? c
              : a.name.toLowerCase().compareTo(b.name.toLowerCase());
      }
    }

    list.sort((a, b) => dir * cmp(a, b));
    return list;
  }

  int _countFor(String status) {
    final all = _all ?? const <MembershipPlan>[];
    final live = _live;
    return switch (status) {
      'active' => live.where((p) => p.isActive).length,
      'inactive' => live.where((p) => !p.isActive).length,
      'deleted' => all.length - live.length,
      _ => all.length,
    };
  }

  bool get _hasFilters =>
      _search.isNotEmpty ||
      _status.isNotEmpty ||
      _category.isNotEmpty ||
      _branch.isNotEmpty;

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _open(MembershipPlan p) async {
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
      AppRoutes.membershipPlanDetail,
      extra: id,
    );
    if (!mounted) return;
    await _load(silent: true);
    if (next != null && mounted) await _openId(next);
  }

  Future<void> _add() async {
    final id = await context.push<String>(AppRoutes.membershipPlanForm);
    if (!mounted) return;
    await _load(silent: true);
    if (id != null && mounted) await _openId(id);
  }

  Future<void> _menu(MembershipPlan p, String value) async {
    switch (value) {
      case 'view':
        await _open(p);
      case 'edit':
        await context.push(AppRoutes.membershipPlanForm, extra: p);
        if (mounted) _load(silent: true);
      default:
        final action = PlanAction.values.firstWhere((a) => a.name == value);
        final r = await runPlanAction(context, p, action);
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

  Future<void> _pickCategory() async {
    final v = await pickOneSheet(
      context,
      title: 'Category',
      options: [for (final c in _categories) (c, c)],
      current: _category.isEmpty ? null : _category,
      clearLabel: 'All categories',
    );
    if (v == null) return;
    setState(() => _category = v);
  }

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Available at branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branch.isEmpty ? null : _branch,
      clearLabel: 'Every branch',
    );
    if (v == null) return;
    setState(() => _branch = v);
  }

  // ── sheets ────────────────────────────────────────────────────────────────

  void _openDeletedSheet(MembershipPlan p) {
    final canRestore = teamCan(context, 'memberships:restore');
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
                  icon: Icons.tag_rounded,
                  label: 'Plan code',
                  value: p.planCode,
                  color: TeamColors.indigo,
                ),
                TeamFieldTile(
                  icon: Icons.timelapse_rounded,
                  label: 'Duration',
                  value: p.durationLabel,
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.sell_rounded,
                  label: 'Price',
                  value: planMoney(p.finalPrice),
                  color: TeamColors.amber,
                ),
                TeamFieldTile(
                  icon: Icons.groups_rounded,
                  label: 'Members',
                  value: '${p.memberCount}',
                  color: TeamColors.violet,
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
                  final r = await runPlanAction(context, p, PlanAction.restore);
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
    required List<MembershipPlan> rows,
    String Function(MembershipPlan p)? trailing,
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
        icon: Icons.card_membership_rounded,
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
        label: 'Members on a plan',
        value: live.fold(0, (a, p) => a + p.memberCount),
        color: TeamColors.violet,
        icon: Icons.groups_rounded,
      ),
      TeamKpi(
        label: 'Discounted plans',
        value: live.where((p) => p.discountPercentage > 0).length,
        color: TeamColors.rose,
        icon: Icons.local_offer_rounded,
      ),
      TeamKpi(
        label: 'With PT included',
        value: live.where((p) => p.ptSessionsIncluded > 0).length,
        color: TeamColors.teal,
        icon: Icons.sports_gymnastics_rounded,
      ),
    ];
  }

  void _onKpi(int i) {
    final live = _live;
    switch (i) {
      case 0:
        _openPlansSheet(
          title: 'Total plans',
          icon: Icons.card_membership_rounded,
          color: TeamColors.indigo,
          rows: live,
          filter: '',
          trailing: (p) => planMoney(p.finalPrice),
        );
      case 1:
        _openPlansSheet(
          title: 'Active',
          icon: Icons.check_circle_rounded,
          color: TeamColors.green,
          rows: live.where((p) => p.isActive).toList(),
          filter: 'active',
          trailing: (p) => planMoney(p.finalPrice),
        );
      case 2:
        _openPlansSheet(
          title: 'Inactive',
          icon: Icons.pause_circle_rounded,
          color: TeamColors.amber,
          rows: live.where((p) => !p.isActive).toList(),
          filter: 'inactive',
          trailing: (p) => planMoney(p.finalPrice),
        );
      case 3:
        _openPlansSheet(
          title: 'Members on a plan',
          icon: Icons.groups_rounded,
          color: TeamColors.violet,
          rows: ([...live]..sort((a, b) => b.memberCount - a.memberCount)),
          trailing: (p) => '${p.memberCount} members',
        );
      case 4:
        _openPlansSheet(
          title: 'Discounted plans',
          icon: Icons.local_offer_rounded,
          color: TeamColors.rose,
          rows: live.where((p) => p.discountPercentage > 0).toList()
            ..sort(
              (a, b) => b.discountPercentage.compareTo(a.discountPercentage),
            ),
          trailing: (p) => '${_pctText(p.discountPercentage)}% off',
        );
      default:
        _openPlansSheet(
          title: 'With PT included',
          icon: Icons.sports_gymnastics_rounded,
          color: TeamColors.teal,
          rows: live.where((p) => p.ptSessionsIncluded > 0).toList()
            ..sort((a, b) => b.ptSessionsIncluded - a.ptSessionsIncluded),
          trailing: (p) => '${p.ptSessionsIncluded} sessions',
        );
    }
  }

  static String _pctText(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  Widget _insights() {
    final live = _live;
    final active = live.where((p) => p.isActive).length;
    final inactive = live.length - active;
    final deleted = (_all ?? const <MembershipPlan>[]).length - live.length;

    final byMembers = [...live]
      ..sort((a, b) => b.memberCount.compareTo(a.memberCount));
    final categoryCounts = <String, int>{};
    for (final p in live) {
      final key = p.category ?? 'Uncategorized';
      categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
    }
    final byCategory = categoryCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final ladder = [...live]
      ..sort((a, b) => b.finalPrice.compareTo(a.finalPrice));

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
            trailing: planStatus,
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
          icon: Icons.sell_rounded,
          title: 'Plans by category',
          color: TeamColors.teal,
          onTap: byCategory.isEmpty ? null : _pickCategory,
          child: TeamBarRows(
            rows: [for (final e in byCategory.take(6)) (e.key, e.value)],
            colors: const [TeamColors.teal, TeamColors.green],
          ),
        ),
        TeamInsightCard(
          icon: Icons.groups_rounded,
          title: 'Members per plan',
          color: TeamColors.violet,
          onTap: () => _openPlansSheet(
            title: 'Members per plan',
            icon: Icons.groups_rounded,
            color: TeamColors.violet,
            rows: byMembers,
            trailing: (p) => '${p.memberCount} members',
          ),
          child: TeamBarRows(
            rows: [for (final p in byMembers.take(6)) (p.name, p.memberCount)],
            colors: const [TeamColors.violet, TeamColors.indigo],
          ),
        ),
        TeamInsightCard(
          icon: Icons.stacked_bar_chart_rounded,
          title: 'Price ladder',
          color: TeamColors.amber,
          trailing: ladder.isEmpty ? null : 'incl. tax',
          onTap: () => _openPlansSheet(
            title: 'Price ladder',
            icon: Icons.stacked_bar_chart_rounded,
            color: TeamColors.amber,
            rows: ladder,
            trailing: (p) => planMoney(p.finalPrice),
          ),
          child: PlanMoneyBars(
            rows: [for (final p in ladder.take(5)) (p.name, p.finalPrice)],
            colors: const [TeamColors.amber, TeamColors.rose],
          ),
        ),
      ],
    );
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final canCreate = teamCan(context, 'memberships:create');
    final canUpdate = teamCan(context, 'memberships:update');
    final canDelete = teamCan(context, 'memberships:delete');
    final canRestore = teamCan(context, 'memberships:restore');

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
              canUpdate: canUpdate,
              canCreate: canCreate,
              canDelete: canDelete,
              canRestore: canRestore,
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _body({
    required bool canUpdate,
    required bool canCreate,
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
            icon: Icons.card_membership_outlined,
            title: _hasFilters
                ? 'No membership plans match these filters'
                : 'No membership plans yet',
            message: _hasFilters
                ? 'Try clearing a filter or the search.'
                : canCreate
                    ? 'Add your first membership plan to get started.'
                    : 'Nothing to show yet.',
          ),
        ),
      ];
    }
    final names = _branchNames;
    return [
      teamCardSliver<MembershipPlan>(
        context,
        items: items,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (p, i) => _Rise(
          index: i,
          child: PlanCard(
            key: ValueKey('plan-${p.id}'),
            plan: p,
            compact: _compact,
            canUpdate: canUpdate,
            branchNames: names,
            actions: availablePlanActions(
              p,
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
    final branchLabel =
        _branch.isEmpty ? 'Any branch' : _branchNames[_branch] ?? 'Branch';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSearchField(
          hint: 'Search name, code, category, description…',
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
        if (_categories.isNotEmpty || _branches.isNotEmpty) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              if (_categories.isNotEmpty)
                Expanded(
                  child: TeamToolbarButton(
                    icon: Icons.sell_rounded,
                    label: _category.isEmpty ? 'Any category' : _category,
                    active: _category.isNotEmpty,
                    onTap: _pickCategory,
                  ),
                ),
              if (_categories.isNotEmpty && _branches.isNotEmpty)
                const SizedBox(width: 8),
              if (_branches.isNotEmpty)
                Expanded(
                  child: TeamToolbarButton(
                    icon: Icons.storefront_rounded,
                    label: branchLabel,
                    active: _branch.isNotEmpty,
                    onTap: _pickBranch,
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _hero(double top, bool canCreate) {
    final all = _all;
    final live = _live;
    final deleted = all == null ? 0 : all.length - live.length;
    final members = live.fold(0, (a, p) => a + p.memberCount);
    return ListHero(
      title: 'Membership Plans',
      subtitle: all == null
          ? "The gym's plan catalog."
          : '${live.length} ${live.length == 1 ? 'plan' : 'plans'}'
              '${deleted > 0 ? ' · $deleted deleted' : ''}'
              ' · $members members enrolled',
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
          if (f.value != 'deleted' || deleted > 0)
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

  final MembershipPlan plan;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = plan;
    final tone = planTone(p);
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
                        if (p.planCode.isNotEmpty) p.planCode,
                        p.durationLabel,
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

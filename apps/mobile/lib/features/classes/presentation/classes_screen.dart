import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/group_class.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'class_actions.dart';
import 'class_ui.dart';
import 'widgets/class_card.dart';

const _sorts = [
  ('name:asc', 'Name (A-Z)'),
  ('name:desc', 'Name (Z-A)'),
  ('createdAt:desc', 'Newest first'),
  ('createdAt:asc', 'Oldest first'),
];

const _statusFilters = [
  (label: 'All', value: ''),
  (label: 'Active', value: 'active'),
  (label: 'Inactive', value: 'inactive'),
];

/// Pure filter + sort behind the catalog list (also unit-tested). [status] is
/// `''` / `'active'` / `'inactive'`; Active and Inactive exclude soft-deleted
/// classes, All keeps them (web loads `includeDeleted: true`). [sort] is
/// `name|createdAt` + `:asc|desc`; search matches the class name.
List<GroupClass> filterClasses(
  List<GroupClass> all, {
  String search = '',
  String status = '',
  String sort = 'name:asc',
}) {
  final q = search.trim().toLowerCase();
  final list = all.where((c) {
    switch (status) {
      case 'active':
        if (c.isDeleted || !c.isActive) return false;
      case 'inactive':
        if (c.isDeleted || c.isActive) return false;
    }
    return q.isEmpty || c.name.toLowerCase().contains(q);
  }).toList();
  final parts = sort.split(':');
  final dir = parts.length > 1 && parts[1] == 'desc' ? -1 : 1;
  int cmp(GroupClass a, GroupClass b) {
    if (parts[0] == 'createdAt') {
      final x = a.createdAt, y = b.createdAt;
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x.compareTo(y);
    }
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  }

  list.sort((a, b) => dir * cmp(a, b));
  return list;
}

/// Owner / Manager / Trainer Classes catalog, brought to parity with web's
/// `/classes` page and the Plans / Branches / Team design language: gradient
/// [ListHero] (status chips with counts, Calendar, New class), KPI tiles and
/// insight panels that open bottom sheets, search + sort + cards / compact
/// toggle, rich class cards with a Delete / Restore menu.
///
/// Entry point and gating are unchanged: Menu -> Programs -> Classes
/// (`classes:view` + the `live_classes` flag, enforced by the menu tile).
/// Inside the screen the actions follow web's own gates: New class
/// (`classes:create`), Delete (`classes:delete`) and Restore
/// (`classes:restore`).
///
/// All classes (soft-deleted included, as web does) are loaded once through
/// [GroupClassRepository.listAll]; search, status, sort and every count are
/// computed on the device. That keeps the KPIs unaffected by the filters
/// (like web's second unfiltered query) and sidesteps the API's
/// `isActive=false` coercion bug (the Inactive filter would otherwise return
/// the active classes). Soft-deleted classes 404 on `GET /classes/:id`, so a
/// deleted card opens a restore sheet instead of the detail page.
///
/// **Dropped vs. web**: nothing with an endpoint. There is no Duplicate or
/// Activate / Deactivate (the API has neither; `isActive` is a field on the
/// class form) and web's pagination is replaced by one scrolling list.
class ClassesScreen extends StatefulWidget {
  const ClassesScreen({super.key});

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  List<GroupClass>? _all;
  bool _loading = true;
  String? _error;

  String _search = '';
  String _status = '';
  String _sort = 'name:asc';
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
      final all = await getIt<GroupClassRepository>().listAll();
      if (!mounted) return;
      setState(() {
        _all = all;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load classes ($e)');
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

  List<GroupClass> get _live =>
      (_all ?? const <GroupClass>[]).where((c) => !c.isDeleted).toList();

  List<GroupClass> get _visible => filterClasses(
        _all ?? const [],
        search: _search,
        status: _status,
        sort: _sort,
      );

  int _countFor(String status) {
    final all = _all ?? const <GroupClass>[];
    final live = _live;
    return switch (status) {
      'active' => live.where((c) => c.isActive).length,
      'inactive' => live.where((c) => !c.isActive).length,
      _ => all.length,
    };
  }

  bool get _hasFilters => _search.isNotEmpty || _status.isNotEmpty;

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _open(GroupClass c) async {
    if (c.isDeleted) {
      _openDeletedSheet(c);
      return;
    }
    await context.push(AppRoutes.classForm, extra: c.id);
    if (mounted) _load(silent: true);
  }

  Future<void> _add() async {
    await context.push(AppRoutes.classForm);
    if (mounted) _load(silent: true);
  }

  Future<void> _openCalendar() async {
    await context.push(AppRoutes.classesCalendar);
    if (mounted) _load(silent: true);
  }

  Future<void> _menu(GroupClass c, String value) async {
    if (value == 'view') {
      await _open(c);
      return;
    }
    final action = ClassAction.values.firstWhere((a) => a.name == value);
    final ok = await runClassAction(context, c, action);
    if (ok && mounted) _load(silent: true);
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

  void _openDeletedSheet(GroupClass c) {
    final canRestore = teamCan(context, 'classes:restore');
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: Icons.delete_outline_rounded,
        title: c.name,
        subtitle: 'Deleted ${fmtDate(c.deletedAt)}',
        color: TeamColors.rose,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TeamTileGrid(
              tiles: [
                TeamFieldTile(
                  icon: Icons.storefront_rounded,
                  label: 'Branch',
                  value: c.branch?.name,
                  color: TeamColors.indigo,
                ),
                TeamFieldTile(
                  icon: Icons.person_rounded,
                  label: 'Trainer',
                  value: c.trainer?.name,
                  color: TeamColors.violet,
                ),
                TeamFieldTile(
                  icon: Icons.groups_rounded,
                  label: 'Capacity',
                  value: '${c.capacity} seats',
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.timelapse_rounded,
                  label: 'Duration',
                  value: '${c.durationMinutes} min',
                  color: TeamColors.amber,
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (canRestore)
              TeamGradientButton(
                label: 'Restore class',
                icon: Icons.restore_from_trash_rounded,
                gradient: TeamColors.ctaGreen,
                onTap: () async {
                  Navigator.of(sheetContext).pop();
                  final ok = await runClassAction(
                    context,
                    c,
                    ClassAction.restore,
                  );
                  if (ok && mounted) _load(silent: true);
                },
              )
            else
              Text(
                'You do not have permission to restore classes.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              ),
          ],
        ),
      ),
    );
  }

  /// A class-per-row sheet. [trailing] gives the right-hand text; when
  /// [filter] is set a button applies it to the main list.
  void _openClassesSheet({
    required String title,
    required IconData icon,
    required Color color,
    required List<GroupClass> rows,
    String Function(GroupClass c)? trailing,
    String? filter,
    String? subtitle,
  }) {
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: icon,
        title: title,
        subtitle: subtitle ??
            '${rows.length} ${rows.length == 1 ? 'class' : 'classes'}',
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
              for (final c in rows)
                _ClassRow(
                  groupClass: c,
                  trailing: trailing?.call(c),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _open(c);
                  },
                ),
          ],
        ),
      ),
    );
  }

  // ── KPIs + insights ───────────────────────────────────────────────────────

  int get _totalSeats =>
      (_all ?? const <GroupClass>[]).fold(0, (a, c) => a + c.capacity);

  List<TeamKpi> _kpis() {
    final all = _all ?? const <GroupClass>[];
    final live = _live;
    return [
      TeamKpi(
        label: 'Total classes',
        value: all.length,
        color: TeamColors.indigo,
        icon: Icons.calendar_month_rounded,
        active: _status.isEmpty,
      ),
      TeamKpi(
        label: 'Active',
        value: live.where((c) => c.isActive).length,
        color: TeamColors.green,
        icon: Icons.check_circle_rounded,
        active: _status == 'active',
      ),
      TeamKpi(
        label: 'Inactive',
        value: live.where((c) => !c.isActive).length,
        color: TeamColors.amber,
        icon: Icons.pause_circle_rounded,
        active: _status == 'inactive',
      ),
      TeamKpi(
        label: 'Total seats / week',
        value: _totalSeats,
        color: TeamColors.violet,
        icon: Icons.groups_rounded,
      ),
    ];
  }

  void _onKpi(int i) {
    final all = _all ?? const <GroupClass>[];
    final live = _live;
    switch (i) {
      case 0:
        _openClassesSheet(
          title: 'Total classes',
          icon: Icons.calendar_month_rounded,
          color: TeamColors.indigo,
          rows: all,
          filter: '',
          trailing: classStatus,
        );
      case 1:
        _openClassesSheet(
          title: 'Active',
          icon: Icons.check_circle_rounded,
          color: TeamColors.green,
          rows: live.where((c) => c.isActive).toList(),
          filter: 'active',
          trailing: (c) => '${c.capacity} seats',
        );
      case 2:
        _openClassesSheet(
          title: 'Inactive',
          icon: Icons.pause_circle_rounded,
          color: TeamColors.amber,
          rows: live.where((c) => !c.isActive).toList(),
          filter: 'inactive',
          trailing: (c) => '${c.capacity} seats',
        );
      default:
        _openClassesSheet(
          title: 'Total seats / week',
          icon: Icons.groups_rounded,
          color: TeamColors.violet,
          rows: ([...all]..sort((a, b) => b.capacity - a.capacity)),
          trailing: (c) => '${c.capacity} seats',
          subtitle:
              '$_totalSeats seats across ${plural(all.length, 'class', 'classes')}',
        );
    }
  }

  List<(String, int)> _rowsBy(String Function(GroupClass c) key) {
    final counts = <String, int>{};
    for (final c in _live) {
      final k = key(c);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    final sorted = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return [for (final e in sorted.take(6)) (e.key, e.value)];
  }

  Widget _insights() {
    final live = _live;
    final active = live.where((c) => c.isActive).length;
    final inactive = live.length - active;
    final byBranch = _rowsBy((c) => c.branch?.name ?? 'No branch');
    final byTrainer = _rowsBy((c) => c.trainer?.name ?? 'Unassigned');

    return TeamAdaptive(
      children: [
        TeamInsightCard(
          icon: Icons.donut_large_rounded,
          title: 'Status mix',
          color: TeamColors.indigo,
          trailing: plural(live.length, 'class', 'classes'),
          onTap: () => _openClassesSheet(
            title: 'Status mix',
            icon: Icons.donut_large_rounded,
            color: TeamColors.indigo,
            rows: live,
            filter: '',
            trailing: classStatus,
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
          icon: Icons.storefront_rounded,
          title: 'By branch',
          color: TeamColors.teal,
          child: TeamBarRows(
            rows: byBranch,
            colors: const [TeamColors.teal, TeamColors.green],
          ),
        ),
        TeamInsightCard(
          icon: Icons.person_rounded,
          title: 'By trainer',
          color: TeamColors.violet,
          child: TeamBarRows(
            rows: byTrainer,
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
    final canCreate = teamCan(context, 'classes:create');
    final canDelete = teamCan(context, 'classes:delete');
    final canRestore = teamCan(context, 'classes:restore');

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
            icon: Icons.calendar_month_outlined,
            title: _hasFilters
                ? 'No classes match these filters'
                : 'No classes yet',
            message: _hasFilters
                ? 'Try clearing a filter or the search.'
                : canCreate
                    ? 'Create your first class to get started.'
                    : 'Nothing to show yet.',
          ),
        ),
      ];
    }
    return [
      teamCardSliver<GroupClass>(
        context,
        items: items,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (c, i) => _Rise(
          index: i,
          child: ClassCard(
            key: ValueKey('class-${c.id}'),
            groupClass: c,
            compact: _compact,
            actions: availableClassActions(
              c,
              canDelete: canDelete,
              canRestore: canRestore,
            ),
            onTap: () => _open(c),
            onMenu: (v) => _menu(c, v),
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
          hint: 'Search class name…',
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
      ],
    );
  }

  Widget _hero(double top, bool canCreate) {
    final all = _all;
    final live = _live;
    final deleted = all == null ? 0 : all.length - live.length;
    return ListHero(
      title: 'Classes',
      subtitle: all == null
          ? 'Recurring group classes and weekly schedules.'
          : '${plural(live.length, 'class', 'classes')}'
              '${deleted > 0 ? ' · $deleted deleted' : ''}'
              ' · $_totalSeats seats',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        ListHeroButton(
          icon: Icons.calendar_month_rounded,
          onTap: _openCalendar,
        ),
        if (canCreate) ListHeroButton(icon: Icons.add_rounded, onTap: _add),
      ],
      chips: [
        for (final f in _statusFilters)
          ClassHeroChip(
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

/// A class line inside the KPI / insight sheets.
class _ClassRow extends StatelessWidget {
  const _ClassRow({
    required this.groupClass,
    required this.onTap,
    this.trailing,
  });

  final GroupClass groupClass;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = groupClass;
    final tone = classTone(c);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 2),
          child: Row(
            children: [
              ClassGlyph(name: c.name, color: tone, size: 32),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                    Text(
                      [
                        c.branch?.name ?? 'No branch',
                        c.trainer?.name ?? 'Unassigned',
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

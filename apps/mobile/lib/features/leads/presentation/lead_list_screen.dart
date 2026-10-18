import 'dart:async';

import '../../../shared/widgets/list_hero.dart';
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
import '../../../models/lead.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/lead_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import 'lead_ui.dart';
import 'widgets/lead_card.dart';
import 'widgets/lead_widgets.dart';

/// Route argument: initial server-side filters (the dashboard's follow-up
/// tiles open the list pre-filtered to overdue / today) and optionally the
/// board view.
class LeadListArgs {
  const LeadListArgs({this.filters = const LeadFilters(), this.board = false});

  final LeadFilters filters;
  final bool board;
}

const _sortOptions = [
  ('createdAt', 'desc', 'Newest first'),
  ('createdAt', 'asc', 'Oldest first'),
  ('name', 'asc', 'Name (A-Z)'),
  ('name', 'desc', 'Name (Z-A)'),
  ('nextFollowUpAt', 'asc', 'Next follow-up (soonest)'),
  ('lastActivityAt', 'desc', 'Recently active'),
  ('expectedJoinDate', 'asc', 'Expected join (soonest)'),
  ('updatedAt', 'desc', 'Recently updated'),
];

const _followUpLabels = {
  'overdue': 'Overdue',
  'today': 'Due today',
  'upcoming': 'Upcoming',
  'none': 'None set',
};

String _sortLabel(LeadFilters f) {
  for (final o in _sortOptions) {
    if (o.$1 == f.sortBy && o.$2 == f.sortDir) return o.$3;
  }
  return 'Newest first';
}

/// Lead list — `GET /leads`, the mobile counterpart of web's pipeline
/// (Board and Table views). Gradient header with live match / open counts,
/// debounced search, coloured status chips carrying the server `counts` (all
/// filters except status), sort + filter sheets (source multi, assignee
/// Anyone/Me/Unassigned/specific, follow-up, interested plan, created-date
/// range) and removable active-filter pills. **List** view is infinite
/// scroll over [PaginatedListCubit]; **Board** view is one column per stage
/// of the 100 most recently active matching leads (like web's kanban).
/// Pushed route, so it reloads on every visit (no IndexedStack tab-cache
/// trap).
///
/// Dropped vs web: branch filter (web only reads it from the URL, no
/// control), bulk CSV export (needs `leads:export` + a file-saving package
/// the app lacks).
class LeadListScreen extends StatefulWidget {
  const LeadListScreen({super.key, this.args = const LeadListArgs()});

  final LeadListArgs args;

  @override
  State<LeadListScreen> createState() => _LeadListScreenState();
}

class _LeadListScreenState extends State<LeadListScreen> {
  late LeadFilters _filters = widget.args.filters;
  late bool _board = widget.args.board;
  late final PaginatedListCubit<Lead> _list;
  final ValueNotifier<LeadCounts?> _counts = ValueNotifier(null);
  final ValueNotifier<LeadSummary?> _summary = ValueNotifier(null);
  final _scroll = ScrollController();
  List<LeadAssignee> _assignees = const [];

  List<Lead>? _boardItems;
  bool _boardLoading = false;
  String? _boardError;
  int _boardTotal = 0;

  @override
  void initState() {
    super.initState();
    final repo = getIt<LeadRepository>();
    _list = PaginatedListCubit<Lead>((page) async {
      final r = await repo.list(page: page, filters: _filters);
      _counts.value = r.counts ?? _counts.value;
      _summary.value = r.summary ?? _summary.value;
      return r.page;
    });
    _reload();
    _scroll.addListener(() {
      if (!_board &&
          _scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
        _list.loadMore();
      }
    });
    unawaited(
      repo.assignees().then((a) {
        if (mounted) setState(() => _assignees = a);
      }).catchError((Object _) => null),
    );
  }

  @override
  void dispose() {
    _list.close();
    _counts.dispose();
    _summary.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reload() {
    if (_board) return _loadBoard();
    return _list.load();
  }

  Future<void> _loadBoard() async {
    setState(() {
      _boardLoading = true;
      _boardError = null;
    });
    try {
      final r = await getIt<LeadRepository>().list(
        limit: 100,
        filters: _filters.copyWith(
          sortBy: 'lastActivityAt',
          sortDir: 'desc',
        ),
      );
      _counts.value = r.counts ?? _counts.value;
      _summary.value = r.summary ?? _summary.value;
      if (mounted) {
        setState(() {
          _boardItems = r.page.items;
          _boardTotal = r.page.total;
          _boardLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _boardError = e.message;
          _boardLoading = false;
        });
      }
    } on Object {
      if (mounted) {
        setState(() {
          _boardError = 'Could not load leads.';
          _boardLoading = false;
        });
      }
    }
  }

  void _apply(LeadFilters f) {
    setState(() => _filters = f);
    _reload();
  }

  void _setBoard(bool board) {
    if (_board == board) return;
    setState(() => _board = board);
    _reload();
  }

  Future<void> _openFilters() async {
    final result = await showLeadSheet<LeadFilters>(
      context,
      (_) => _FilterSheet(initial: _filters, assignees: _assignees),
    );
    if (result != null) _apply(result);
  }

  Future<void> _openSort() async {
    final res = await pickOne<String>(
      context,
      title: 'Sort by',
      icon: Icons.sort_rounded,
      color: LeadColors.indigo,
      selected: '${_filters.sortBy}|${_filters.sortDir}',
      options: [
        for (final o in _sortOptions) PickerOption('${o.$1}|${o.$2}', o.$3),
      ],
    );
    final v = res?.picked;
    if (v == null) return;
    final parts = v.split('|');
    _apply(_filters.copyWith(sortBy: parts[0], sortDir: parts[1]));
  }

  String _assigneeLabel(String a) {
    if (a == 'me') return 'Assigned to me';
    if (a == 'unassigned') return 'Unassigned';
    for (final x in _assignees) {
      if (x.id == a) return x.name;
    }
    return 'Assignee';
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = leadsCan(context, 'leads:create');
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Leads'),
        actions: [
          if (canCreate)
            IconButton(
              tooltip: 'New lead',
              onPressed: () =>
                  context.push(AppRoutes.leadForm).then((_) => _reload()),
              icon: const Icon(Icons.add_circle_outline_rounded),
            ),
        ],
      ),
      body: BlocBuilder<PaginatedListCubit<Lead>, PaginatedListState<Lead>>(
        bloc: _list,
        builder: (context, state) {
          return RefreshIndicator(
            color: AppColors.staffB,
            backgroundColor: AppColors.surface2,
            edgeOffset: top,
            onRefresh: _reload,
            child: CustomScrollView(
              controller: _scroll,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _header(top)),
                SliverToBoxAdapter(child: _toolbar()),
                ..._content(state),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _header(double top) {
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: SizedBox(
        width: double.infinity,
        child: Padding(
          padding: EdgeInsets.fromLTRB(18, top + 2, 18, 18),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kListHeroBelowAppBar),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FadeUp(
                  index: 0,
                  child: Text(
                    'All leads',
                    style: AppText.display(size: 26, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 8),
                FadeUp(
                  index: 1,
                  child: ValueListenableBuilder<LeadSummary?>(
                    valueListenable: _summary,
                    builder: (_, s, __) => Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        LeadHeroPill(
                          s == null ? 'Loading…' : '${s.total} matching',
                          icon: Icons.groups_rounded,
                        ),
                        if (s != null) ...[
                          LeadHeroPill(
                            '${s.open} open',
                            icon: Icons.bolt_rounded,
                          ),
                          LeadHeroPill(
                            '${s.converted} converted',
                            icon: Icons.verified_rounded,
                          ),
                          if (s.followUpsOverdue > 0)
                            LeadHeroPill(
                              '${s.followUpsOverdue} overdue',
                              icon: Icons.alarm_rounded,
                              dot: const Color(0xFFFDA4AF),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                FadeUp(
                  index: 2,
                  child: DebouncedSearchField(
                    hint: 'Search name, phone or email',
                    onChanged: (v) => _apply(_filters.copyWith(search: v)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _toolbar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 14, 0, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 38,
            child: ValueListenableBuilder<LeadCounts?>(
              valueListenable: _counts,
              builder: (_, c, __) => ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                children: [
                  _StatusChip(
                    label: 'All',
                    count: c?.all,
                    color: LeadColors.violet,
                    icon: Icons.apps_rounded,
                    selected: _filters.status == null,
                    onTap: () => _apply(_filters.copyWith(clearStatus: true)),
                  ),
                  for (final s in LeadStatus.values)
                    _StatusChip(
                      label: s.label,
                      count: c?.of(s),
                      color: leadStatusColor(s),
                      icon: leadStatusIcon(s),
                      selected: _filters.status == s,
                      onTap: () => _apply(
                        _filters.status == s
                            ? _filters.copyWith(clearStatus: true)
                            : _filters.copyWith(status: s),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              children: [
                Expanded(
                  child: _ToolButton(
                    icon: Icons.sort_rounded,
                    label: _sortLabel(_filters),
                    onTap: _board ? null : _openSort,
                  ),
                ),
                const SizedBox(width: 8),
                _ToolButton(
                  icon: Icons.tune_rounded,
                  label: 'Filters',
                  badge: _filters.activeFilterCount,
                  onTap: _openFilters,
                ),
                const SizedBox(width: 8),
                _ViewToggle(board: _board, onChanged: _setBoard),
              ],
            ),
          ),
          if (_filters.activeFilterCount > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (_filters.sources.isNotEmpty)
                    _ActiveFilter(
                      label: _filters.sources.map((s) => s.label).join(', '),
                      icon: Icons.campaign_rounded,
                      onClear: () =>
                          _apply(_filters.copyWith(sources: <LeadSource>{})),
                    ),
                  if (_filters.assignedTo != null)
                    _ActiveFilter(
                      label: _assigneeLabel(_filters.assignedTo!),
                      icon: Icons.person_rounded,
                      onClear: () =>
                          _apply(_filters.copyWith(clearAssignedTo: true)),
                    ),
                  if (_filters.followUp != null)
                    _ActiveFilter(
                      label: 'Follow-up: ${_followUpLabels[_filters.followUp]}',
                      icon: Icons.alarm_rounded,
                      onClear: () =>
                          _apply(_filters.copyWith(clearFollowUp: true)),
                    ),
                  if (_filters.planId != null)
                    _ActiveFilter(
                      label: _filters.planName ?? 'Plan',
                      icon: Icons.card_membership_rounded,
                      onClear: () => _apply(_filters.copyWith(clearPlan: true)),
                    ),
                  if (_filters.createdFrom != null ||
                      _filters.createdTo != null)
                    _ActiveFilter(
                      label:
                          'Created ${_filters.createdFrom == null ? '…' : fmtDay(_filters.createdFrom)}'
                          ' – ${_filters.createdTo == null ? '…' : fmtDay(_filters.createdTo)}',
                      icon: Icons.date_range_rounded,
                      onClear: () =>
                          _apply(_filters.copyWith(clearCreated: true)),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _content(PaginatedListState<Lead> state) {
    if (_board) return _boardSlivers();
    return switch (state) {
      PaginatedListLoading<Lead>() => const [
          SliverFillRemaining(hasScrollBody: false, child: AppLoadingView()),
        ],
      PaginatedListError<Lead>(:final message) => [
          SliverFillRemaining(
            hasScrollBody: false,
            child: AppErrorView(message: message, onRetry: _list.load),
          ),
        ],
      PaginatedListLoaded<Lead>(:final items, :final hasMore) => items.isEmpty
          ? const [
              SliverFillRemaining(
                hasScrollBody: false,
                child: AppEmptyState(
                  title: 'No leads match',
                  message: 'Try a different status, search or filter.',
                  icon: Icons.person_search_outlined,
                ),
              ),
            ]
          : [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
                sliver: SliverList.builder(
                  itemCount: items.length + (hasMore ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i >= items.length) {
                      return const Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(
                          child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                      );
                    }
                    return LeadCard(lead: items[i], onReturn: _list.load);
                  },
                ),
              ),
            ],
    };
  }

  List<Widget> _boardSlivers() {
    if (_boardLoading && _boardItems == null) {
      return const [
        SliverFillRemaining(hasScrollBody: false, child: AppLoadingView()),
      ];
    }
    if (_boardError != null && _boardItems == null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppErrorView(message: _boardError!, onRetry: _loadBoard),
        ),
      ];
    }
    final items = _boardItems ?? const <Lead>[];
    final columns = _filters.status == null
        ? LeadStatus.values
        : <LeadStatus>[_filters.status!];
    return [
      if (_boardTotal > items.length)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 8),
            child: Text(
              'Showing the ${items.length} most recently active of '
              '$_boardTotal matching leads. Narrow the filters or switch to '
              'the list to see the rest.',
              style: AppText.body(size: 11.5, color: AppColors.inkFaint),
            ),
          ),
        ),
      SliverToBoxAdapter(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < columns.length; i++)
                _BoardColumn(
                  status: columns[i],
                  count: _counts.value?.of(columns[i]),
                  leads: items.where((l) => l.status == columns[i]).toList(),
                  index: i,
                  onReturn: _loadBoard,
                ),
            ],
          ),
        ),
      ),
    ];
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.count,
    required this.color,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int? count;
  final Color color;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(99),
            color: selected ? color.withValues(alpha: 0.18) : AppColors.surface,
            border: Border.all(
              color: selected ? color : AppColors.line,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 14,
                color: selected ? color : AppColors.inkFaint,
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: selected ? color : AppColors.inkSoft,
                ),
              ),
              if (count != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: selected ? 0.25 : 0.12),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    '$count',
                    style: AppText.body(
                      size: 10.5,
                      weight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ToolButton extends StatelessWidget {
  const _ToolButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final active = badge > 0;
    return Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.field),
          onTap: onTap,
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: active
                  ? LeadColors.violet.withValues(alpha: 0.14)
                  : AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.field),
              border: Border.all(
                color: active ? LeadColors.violet : AppColors.line,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: active ? LeadColors.violet : AppColors.inkFaint,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 12.5, weight: FontWeight.w700),
                  ),
                ),
                if (active) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 18,
                    height: 18,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: LeadColors.violet,
                    ),
                    child: Text(
                      '$badge',
                      style: AppText.body(
                        size: 10,
                        weight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ViewToggle extends StatelessWidget {
  const _ViewToggle({required this.board, required this.onChanged});

  final bool board;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget seg(bool isBoard, IconData icon, String tip) {
      final sel = board == isBoard;
      return Tooltip(
        message: tip,
        child: GestureDetector(
          onTap: () => onChanged(isBoard),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            width: 38,
            height: 34,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              gradient: sel ? LeadColors.cta : null,
            ),
            child: Icon(
              icon,
              size: 18,
              color: sel ? Colors.white : AppColors.inkFaint,
            ),
          ),
        ),
      );
    }

    return Container(
      height: 40,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.field),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          seg(false, Icons.view_agenda_rounded, 'List view'),
          seg(true, Icons.view_kanban_rounded, 'Board view'),
        ],
      ),
    );
  }
}

class _ActiveFilter extends StatelessWidget {
  const _ActiveFilter({
    required this.label,
    required this.icon,
    required this.onClear,
  });

  final String label;
  final IconData icon;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onClear,
      child: Container(
        padding: const EdgeInsets.fromLTRB(9, 5, 7, 5),
        decoration: BoxDecoration(
          color: LeadColors.violet.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: LeadColors.violet.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: LeadColors.violet),
            const SizedBox(width: 5),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 200),
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: LeadColors.violet,
                ),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.close_rounded, size: 14, color: LeadColors.violet),
          ],
        ),
      ),
    );
  }
}

class _BoardColumn extends StatelessWidget {
  const _BoardColumn({
    required this.status,
    required this.count,
    required this.leads,
    required this.index,
    required this.onReturn,
  });

  final LeadStatus status;
  final int? count;
  final List<Lead> leads;
  final int index;
  final VoidCallback onReturn;

  @override
  Widget build(BuildContext context) {
    final c = leadStatusColor(status);
    return FadeUp(
      index: index,
      child: Container(
        width: 292,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: c.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              decoration: BoxDecoration(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(21)),
                gradient: LinearGradient(
                  colors: [
                    c.withValues(alpha: 0.25),
                    c.withValues(alpha: 0.03),
                  ],
                ),
              ),
              child: Row(
                children: [
                  Icon(leadStatusIcon(status), size: 17, color: c),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      status.label,
                      style: AppText.display(size: 14.5),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                    decoration: BoxDecoration(
                      color: c.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      '${count ?? leads.length}',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w800,
                        color: c,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: leads.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 18),
                      child: Center(child: LeadEmptyLine('No leads')),
                    )
                  : Column(
                      children: [
                        for (final l in leads)
                          LeadCard(lead: l, compact: true, onReturn: onReturn),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── filter sheet ───────────────────────────────────────────────────────────

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.initial, required this.assignees});

  final LeadFilters initial;
  final List<LeadAssignee> assignees;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late final Set<LeadSource> _sources = {...widget.initial.sources};
  late String? _assigned = widget.initial.assignedTo;
  late String? _followUp = widget.initial.followUp;
  late String? _planId = widget.initial.planId;
  late String? _planName = widget.initial.planName;
  late DateTime? _from = DateTime.tryParse(widget.initial.createdFrom ?? '');
  late DateTime? _to = DateTime.tryParse(widget.initial.createdTo ?? '');
  late String _sort = '${widget.initial.sortBy}|${widget.initial.sortDir}';
  String? _error;

  Future<void> _pickPlan() async {
    try {
      final r = await getIt<MembershipPlanRepository>()
          .list(limit: 100, isActive: true);
      if (!mounted) return;
      final res = await pickOne<MembershipPlan>(
        context,
        title: 'Interested plan',
        icon: Icons.card_membership_rounded,
        options: [
          const PickerOption<MembershipPlan>(null, 'Any plan'),
          for (final p in r.items) PickerOption(p, p.name),
        ],
      );
      if (res != null && mounted) {
        setState(() {
          _planId = res.picked?.id;
          _planName = res.picked?.name;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on Object {
      if (mounted) setState(() => _error = 'Could not load plans');
    }
  }

  Widget _gap() => const SizedBox(height: 16);

  @override
  Widget build(BuildContext context) {
    return LeadSheetScaffold(
      icon: Icons.tune_rounded,
      color: LeadColors.violet,
      title: 'Filter leads',
      subtitle: 'Applied on the server — counts update with them',
      footer: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              onPressed: () => Navigator.of(context).pop(
                widget.initial.copyWith(
                  sources: <LeadSource>{},
                  clearAssignedTo: true,
                  clearFollowUp: true,
                  clearPlan: true,
                  clearCreated: true,
                  sortBy: 'createdAt',
                  sortDir: 'desc',
                ),
              ),
              child: const Text('Reset'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: GestureDetector(
              onTap: () {
                final sort = _sort.split('|');
                Navigator.of(context).pop(
                  widget.initial.copyWith(
                    sources: _sources,
                    assignedTo: _assigned,
                    clearAssignedTo: _assigned == null,
                    followUp: _followUp,
                    clearFollowUp: _followUp == null,
                    planId: _planId,
                    planName: _planName,
                    clearPlan: _planId == null,
                    createdFrom: _from == null ? null : ymd(_from!),
                    createdTo: _to == null ? null : ymd(_to!),
                    clearCreated: _from == null && _to == null,
                    sortBy: sort[0],
                    sortDir: sort[1],
                  ),
                );
              },
              child: Container(
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: LeadColors.cta,
                  boxShadow: [
                    BoxShadow(
                      color: LeadColors.violet.withValues(alpha: 0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Text(
                  'Apply filters',
                  style: AppText.body(
                    size: 14.5,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          LeadChipGroup<String>(
            label: 'SORT BY',
            icon: Icons.sort_rounded,
            color: LeadColors.indigo,
            options: [for (final o in _sortOptions) '${o.$1}|${o.$2}'],
            value: _sort,
            labelOf: (v) =>
                _sortOptions.firstWhere((o) => '${o.$1}|${o.$2}' == v).$3,
            onChanged: (v) => setState(() => _sort = v ?? _sort),
          ),
          _gap(),
          LeadChipGroup<LeadSource>(
            label: 'SOURCE (ANY OF)',
            icon: Icons.campaign_rounded,
            color: LeadColors.teal,
            options: LeadSource.values,
            value: null,
            labelOf: (s) => s.label,
            iconOf: leadSourceIcon,
            colorOf: leadSourceColor,
            selected: _sources,
            onToggle: (s) => setState(() {
              _sources.contains(s) ? _sources.remove(s) : _sources.add(s);
            }),
          ),
          _gap(),
          LeadChipGroup<String>(
            label: 'ASSIGNED TO',
            icon: Icons.person_rounded,
            color: LeadColors.indigo,
            options: [
              '',
              'me',
              'unassigned',
              for (final a in widget.assignees) a.id,
            ],
            value: _assigned ?? '',
            labelOf: (v) => v.isEmpty
                ? 'Anyone'
                : v == 'me'
                    ? 'Me'
                    : v == 'unassigned'
                        ? 'Unassigned'
                        : widget.assignees.firstWhere((a) => a.id == v).name,
            onChanged: (v) =>
                setState(() => _assigned = (v == null || v.isEmpty) ? null : v),
          ),
          _gap(),
          LeadChipGroup<String>(
            label: 'FOLLOW-UP',
            icon: Icons.alarm_rounded,
            color: LeadColors.amber,
            options: ['', ..._followUpLabels.keys],
            value: _followUp ?? '',
            labelOf: (v) => v.isEmpty ? 'Any' : _followUpLabels[v]!,
            onChanged: (v) =>
                setState(() => _followUp = (v == null || v.isEmpty) ? null : v),
          ),
          _gap(),
          LeadValueField(
            label: 'Interested plan',
            icon: Icons.card_membership_rounded,
            color: LeadColors.violet,
            text: _planName,
            hint: 'Any plan',
            onTap: _pickPlan,
            onClear: () => setState(() {
              _planId = null;
              _planName = null;
            }),
          ),
          _gap(),
          Row(
            children: [
              Expanded(
                child: LeadValueField(
                  label: 'Created from',
                  icon: Icons.event_rounded,
                  color: LeadColors.green,
                  text: _from == null ? null : fmtDay(_from),
                  hint: 'Any',
                  trailingIcon: Icons.calendar_month_rounded,
                  onTap: () async {
                    final d = await pickDate(
                      context,
                      initial: _from,
                      last: _to ?? DateTime.now(),
                    );
                    if (d != null) setState(() => _from = d);
                  },
                  onClear: () => setState(() => _from = null),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: LeadValueField(
                  label: 'Created to',
                  icon: Icons.event_busy_rounded,
                  color: LeadColors.rose,
                  text: _to == null ? null : fmtDay(_to),
                  hint: 'Any',
                  trailingIcon: Icons.calendar_month_rounded,
                  onTap: () async {
                    final d = await pickDate(
                      context,
                      initial: _to,
                      first: _from,
                      last: DateTime.now(),
                    );
                    if (d != null) setState(() => _to = d);
                  },
                  onClear: () => setState(() => _to = null),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

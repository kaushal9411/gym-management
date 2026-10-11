import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/lead.dart';
import '../../../repositories/lead_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import 'lead_ui.dart';
import 'widgets/lead_card.dart';

/// Route argument: initial server-side filters (the dashboard's follow-up
/// tiles open the list pre-filtered to overdue / today).
class LeadListArgs {
  const LeadListArgs({this.filters = const LeadFilters()});

  final LeadFilters filters;
}

/// Lead list — `GET /leads`. Status chips carry the server `counts` (all
/// filters except status); search is debounced; source / assignee /
/// follow-up filters live in a bottom sheet and are sent to the server.
/// Infinite scroll via [PaginatedListCubit.loadMore]. Pushed route, so it
/// reloads on every visit (not subject to the IndexedStack tab-cache trap).
///
/// Dropped vs web: sort selector, branch filter, created-date range,
/// bulk export (needs `leads:export` + a file-saving package the app lacks).
class LeadListScreen extends StatefulWidget {
  const LeadListScreen({super.key, this.args = const LeadListArgs()});

  final LeadListArgs args;

  @override
  State<LeadListScreen> createState() => _LeadListScreenState();
}

class _LeadListScreenState extends State<LeadListScreen> {
  late LeadFilters _filters = widget.args.filters;
  late final PaginatedListCubit<Lead> _list;
  final ValueNotifier<LeadCounts?> _counts = ValueNotifier(null);
  final ValueNotifier<LeadSummary?> _summary = ValueNotifier(null);
  final _scroll = ScrollController();
  List<LeadAssignee> _assignees = const [];

  @override
  void initState() {
    super.initState();
    final repo = getIt<LeadRepository>();
    _list = PaginatedListCubit<Lead>((page) async {
      final r = await repo.list(page: page, filters: _filters);
      _counts.value = r.counts ?? _counts.value;
      _summary.value = r.summary ?? _summary.value;
      return r.page;
    })
      ..load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
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

  void _apply(LeadFilters f) {
    setState(() => _filters = f);
    _list.load();
  }

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<LeadFilters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (_) => _FilterSheet(initial: _filters, assignees: _assignees),
    );
    if (result != null) _apply(result);
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = leadsCan(context, 'leads:create');
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: ValueListenableBuilder<LeadSummary?>(
          valueListenable: _summary,
          builder: (_, s, __) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('All leads', style: AppText.display(size: 18)),
              Text(
                s == null ? '' : '${s.total} matching · ${s.open} open',
                style: AppText.eyebrow(),
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Filters',
            onPressed: _openFilters,
            icon: Badge(
              isLabelVisible: _filters.activeFilterCount > 0,
              label: Text('${_filters.activeFilterCount}'),
              child: const Icon(Icons.tune_rounded),
            ),
          ),
          if (canCreate)
            IconButton(
              tooltip: 'New lead',
              onPressed: () =>
                  context.push(AppRoutes.leadForm).then((_) => _list.load()),
              icon: const Icon(Icons.add_circle_outline_rounded),
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 8),
            child: DebouncedSearchField(
              hint: 'Search name, phone or email',
              onChanged: (v) => _apply(_filters.copyWith(search: v)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 18, bottom: 8),
            child: ValueListenableBuilder<LeadCounts?>(
              valueListenable: _counts,
              builder: (_, c, __) => FilterChipsRow<LeadStatus?>(
                selected: _filters.status,
                onSelected: (s) => _apply(
                  s == null
                      ? _filters.copyWith(clearStatus: true)
                      : _filters.copyWith(status: s),
                ),
                options: [
                  FilterChipOption<LeadStatus?>(null, 'All', count: c?.all),
                  for (final s in LeadStatus.values)
                    FilterChipOption<LeadStatus?>(
                      s,
                      s.label,
                      count: c?.of(s),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child:
                BlocBuilder<PaginatedListCubit<Lead>, PaginatedListState<Lead>>(
              bloc: _list,
              builder: (context, state) => switch (state) {
                PaginatedListLoading<Lead>() => const AppLoadingView(),
                PaginatedListError<Lead>(:final message) =>
                  AppErrorView(message: message, onRetry: _list.load),
                PaginatedListLoaded<Lead>() => _body(state),
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(PaginatedListLoaded<Lead> state) {
    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _list.load,
      child: state.items.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 80),
                AppEmptyState(
                  title: 'No leads match',
                  message: 'Try a different status, search or filter.',
                  icon: Icons.person_search_outlined,
                ),
              ],
            )
          : ListView.builder(
              controller: _scroll,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
              itemCount: state.items.length + (state.hasMore ? 1 : 0),
              itemBuilder: (_, i) {
                if (i >= state.items.length) {
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
                return LeadCard(lead: state.items[i], onReturn: _list.load);
              },
            ),
    );
  }
}

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

  Widget _chip(String label, bool selected, VoidCallback onTap) => ChoiceChip(
        label: Text(label),
        selected: selected,
        showCheckmark: false,
        onSelected: (_) => onTap(),
        backgroundColor: AppColors.surface2,
        selectedColor: AppColors.staffSoft,
        side: BorderSide(color: selected ? AppColors.staffB : AppColors.line),
        labelStyle: AppText.body(
          size: 12,
          weight: FontWeight.w700,
          color: selected ? AppColors.staffPillFg : AppColors.inkSoft,
        ),
      );

  Widget _group(String title, List<Widget> chips) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 8),
            child: Text(title, style: AppText.eyebrow()),
          ),
          Wrap(spacing: 8, runSpacing: 8, children: chips),
        ],
      );

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          18,
          0,
          18,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Filter leads', style: AppText.display(size: 18)),
              _group('Source', [
                for (final s in LeadSource.values)
                  _chip(s.label, _sources.contains(s), () {
                    setState(() {
                      _sources.contains(s)
                          ? _sources.remove(s)
                          : _sources.add(s);
                    });
                  }),
              ]),
              _group('Assigned to', [
                _chip(
                  'Anyone',
                  _assigned == null,
                  () => setState(() => _assigned = null),
                ),
                _chip(
                  'Me',
                  _assigned == 'me',
                  () => setState(() => _assigned = 'me'),
                ),
                _chip(
                  'Unassigned',
                  _assigned == 'unassigned',
                  () => setState(() => _assigned = 'unassigned'),
                ),
                for (final a in widget.assignees)
                  _chip(
                    a.name,
                    _assigned == a.id,
                    () => setState(() => _assigned = a.id),
                  ),
              ]),
              _group('Follow-up', [
                _chip(
                  'Any',
                  _followUp == null,
                  () => setState(() => _followUp = null),
                ),
                for (final f in const {
                  'overdue': 'Overdue',
                  'today': 'Due today',
                  'upcoming': 'Upcoming',
                  'none': 'None set',
                }.entries)
                  _chip(
                    f.value,
                    _followUp == f.key,
                    () => setState(() => _followUp = f.key),
                  ),
              ]),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: 'Reset',
                      variant: AppButtonVariant.ghost,
                      onPressed: () => Navigator.of(context).pop(
                        widget.initial.copyWith(
                          sources: <LeadSource>{},
                          clearAssignedTo: true,
                          clearFollowUp: true,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      label: 'Apply',
                      onPressed: () => Navigator.of(context).pop(
                        widget.initial.copyWith(
                          sources: _sources,
                          assignedTo: _assigned,
                          clearAssignedTo: _assigned == null,
                          followUp: _followUp,
                          clearFollowUp: _followUp == null,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

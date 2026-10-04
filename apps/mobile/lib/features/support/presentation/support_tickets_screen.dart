import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/support_ticket.dart';
import '../../../models/support_ticket_stats.dart';
import '../../../repositories/support_ticket_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import 'widgets/support_insights_header.dart';

/// The design pills tickets by **priority** (High is emphasised, Medium is
/// muted), not by status — status lives in the "N open" count up top and,
/// for anything no longer open, in the row's subtext.
const _priorityTones = {
  TicketPriority.urgent: AppPillTone.danger,
  TicketPriority.high: AppPillTone.warning,
  TicketPriority.medium: AppPillTone.neutral,
  TicketPriority.low: AppPillTone.neutral,
};

const _openStatuses = {'OPEN', 'IN_PROGRESS'};

/// Design frame "12. Support" — open count, priority pills and the
/// gradient "+" button. Backs `GET/POST /support/tickets` (tenant-facing
/// create/view plane; gated behind the `support_tickets` plan feature —
/// a 403 here means the current plan doesn't include it, not a bug).
///
/// Above the list: the animated insights header
/// (`GET /support/tickets/stats`, hidden without `support:view` or on 403)
/// and status chips whose badges are the server's `counts` (tenant-wide,
/// unaffected by the chosen status); the chip drives the SERVER-side
/// `status` param. The app-bar "open" figure is the server's
/// open + in-progress count, not a count of the loaded page. Pushed route,
/// so it reloads on every visit.
class SupportTicketsScreen extends StatefulWidget {
  const SupportTicketsScreen({super.key});

  @override
  State<SupportTicketsScreen> createState() => _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends State<SupportTicketsScreen> {
  late final PaginatedListCubit<SupportTicket> _list;
  late final SupportStatsCubit _stats;
  final ValueNotifier<SupportTicketCounts?> _counts = ValueNotifier(null);
  String _status = '';

  bool get _canViewStats {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff &&
        session.user.hasPermission('support:view');
  }

  @override
  void initState() {
    super.initState();
    final repo = getIt<SupportTicketRepository>();
    _list = PaginatedListCubit<SupportTicket>((page) async {
      final r = await repo.listWithCounts(
        page: page,
        status: _status.isEmpty ? null : _status,
      );
      if (r.counts != null) _counts.value = r.counts;
      return r.page;
    })
      ..load();
    _stats = SupportStatsCubit(repo.stats);
    if (_canViewStats) {
      unawaited(_stats.load());
    } else {
      _stats.hide();
    }
  }

  @override
  void dispose() {
    _list.close();
    _stats.close();
    _counts.dispose();
    super.dispose();
  }

  Future<void> _refresh({bool silentStats = false}) async {
    if (_canViewStats) unawaited(_stats.load(null, silentStats));
    await _list.load();
  }

  void _setStatus(String v) {
    if (v == _status) return;
    setState(() => _status = v);
    _list.load();
  }

  List<FilterChipOption<String>> _statusOptions(SupportTicketCounts? c) => [
        FilterChipOption('', 'All', count: c?.all),
        FilterChipOption('OPEN', 'Open', count: c?.open),
        FilterChipOption('IN_PROGRESS', 'In progress', count: c?.inProgress),
        FilterChipOption('RESOLVED', 'Resolved', count: c?.resolved),
        FilterChipOption('CLOSED', 'Closed', count: c?.closed),
      ];

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<PaginatedListCubit<SupportTicket>>.value(value: _list),
        BlocProvider<SupportStatsCubit>.value(value: _stats),
      ],
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: ValueListenableBuilder<SupportTicketCounts?>(
            valueListenable: _counts,
            builder: (context, c, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Support', style: AppText.display(size: 18)),
                Text(
                  '${c == null ? 0 : c.open + c.inProgress} open',
                  style: AppText.eyebrow(),
                ),
              ],
            ),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    onPressed: () {
                      context
                          .push(AppRoutes.supportTicketForm)
                          .then((_) => _refresh(silentStats: true));
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
        body: RefreshIndicator(
          color: AppColors.staffB,
          backgroundColor: AppColors.surface2,
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverPadding(
                padding: EdgeInsets.fromLTRB(18, 4, 18, 0),
                sliver: SliverToBoxAdapter(child: SupportInsightsHeader()),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
                sliver: SliverToBoxAdapter(
                  child: ValueListenableBuilder<SupportTicketCounts?>(
                    valueListenable: _counts,
                    builder: (context, counts, _) => FilterChipsRow<String>(
                      options: _statusOptions(counts),
                      selected: _status,
                      onSelected: _setStatus,
                    ),
                  ),
                ),
              ),
              _buildList(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildList() {
    return BlocBuilder<PaginatedListCubit<SupportTicket>,
        PaginatedListState<SupportTicket>>(
      builder: (context, state) => switch (state) {
        PaginatedListLoading() => const SliverToBoxAdapter(
            child: SizedBox(height: 220, child: AppLoadingView()),
          ),
        PaginatedListError(:final message) => SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: AppErrorView(message: message, onRetry: _list.load),
            ),
          ),
        PaginatedListLoaded(:final items) when items.isEmpty =>
          SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: _status.isEmpty
                  ? const AppEmptyState(
                      icon: Icons.support_agent_outlined,
                      title: 'No support tickets yet',
                      message: 'Tap + to open a ticket with the FitCloud team.',
                    )
                  : const AppEmptyState(
                      icon: Icons.support_agent_outlined,
                      title: 'Nothing matches',
                      message: 'No tickets with that status.',
                    ),
            ),
          ),
        PaginatedListLoaded(
          :final items,
          :final hasMore,
          :final loadingMore,
        ) =>
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
            sliver: SliverList.builder(
              itemCount: items.length + (hasMore ? 1 : 0),
              itemBuilder: (context, i) {
                if (i >= items.length) {
                  return Center(
                    child: loadingMore
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(
                              color: AppColors.staffB,
                            ),
                          )
                        : TextButton(
                            onPressed: _list.loadMore,
                            child: const Text('Load more'),
                          ),
                  );
                }
                return _TicketCard(ticket: items[i]);
              },
            ),
          ),
      },
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});

  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () =>
            context.push(AppRoutes.supportTicketDetail, extra: ticket.id),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      ticket.subject,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                  ),
                  AppPill(
                    label: ticket.priority.label,
                    tone:
                        _priorityTones[ticket.priority] ?? AppPillTone.neutral,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _openStatuses.contains(ticket.status)
                    ? 'Opened ${_formatDate(ticket.createdAt)}'
                    : '${ticket.status.replaceAll('_', ' ').toLowerCase()} · '
                        '${_formatDate(ticket.createdAt)}',
                style: AppText.body(
                  size: 11,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

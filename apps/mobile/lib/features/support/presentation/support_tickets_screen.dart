import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/support_ticket.dart';
import '../../../models/support_ticket_stats.dart';
import '../../../repositories/support_ticket_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../income/presentation/income_filters.dart';
import '../../income/presentation/income_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../reports/presentation/analytics/analytics_logic.dart'
    show analyticsShortDate, previousRange;
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'support_ui.dart';
import 'widgets/support_help_centre.dart';
import 'widgets/support_insights.dart';

/// Support — web's `/support` page, redesigned for the phone and tablet.
///
/// Same order as web: a teal gradient hero (Open / In progress / Resolved
/// chips, "+" to raise a ticket, a mail button for "Contact us"), the Period
/// bar (period chips incl. Custom, Compare), five KPI tiles and the insights
/// (tickets created per day, by status, by priority — all from
/// `GET /support/tickets/stats`; hidden if that call fails, the list keeps
/// working), the help centre (published FAQ pages + the support e-mail card),
/// then the tickets: status chips with the server's counts and cards with
/// Load more. The status filter is the server's `status` parameter.
///
/// A card shows web's fields: the priority colour bar, the creator's initials,
/// subject, a description excerpt, "Raised … ago · date" and the priority and
/// status tags; tapping opens the ticket page.
///
/// Gating (see [SupportAccess]), identical to web: plan flag `support_tickets`
/// ("Not on your plan" otherwise), `support:view` for the list / stats /
/// detail ("No access" otherwise), `support:create` for the "+".
///
/// **Dropped vs web**: numbered pagination (Load more), chart hover tooltips
/// (tap / drag inspection), the status / priority donuts' priority variant
/// (shown as bars), table-style row hover.
class SupportTicketsScreen extends StatefulWidget {
  const SupportTicketsScreen({super.key});

  @override
  State<SupportTicketsScreen> createState() => _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends State<SupportTicketsScreen> {
  late final SupportAccess _access;
  late final PaginatedListCubit<SupportTicket> _list;
  final ValueNotifier<SupportTicketCounts?> _counts = ValueNotifier(null);
  int _total = 0;

  IncomePeriod _period = IncomePeriod.thisMonth;
  DateTimeRange? _custom;
  bool _compare = true;

  SupportTicketStats? _stats;
  bool _statsLoading = true;
  bool _statsError = false;
  int _scope = 0;

  String _status = '';

  ({String from, String to}) get _range => incomeRange(_period, _custom);
  bool get _rangeReady => _range.from.compareTo(_range.to) <= 0;
  String get _previousLabel => _period.previousLabel;

  @override
  void initState() {
    super.initState();
    _access = SupportAccess.of(context);
    final repo = getIt<SupportTicketRepository>();
    _list = PaginatedListCubit<SupportTicket>((page) async {
      final r = await repo.listWithCounts(
        page: page,
        status: _status.isEmpty ? null : _status,
      );
      if (r.counts != null) _counts.value = r.counts;
      if (mounted) setState(() => _total = r.page.total);
      return r.page;
    });
    if (_access.ticketsEnabled) {
      _list.load();
      _loadStats();
    }
  }

  @override
  void dispose() {
    _list.close();
    _counts.dispose();
    super.dispose();
  }

  Future<void> _loadStats({bool silent = false}) async {
    if (!_rangeReady) return;
    final scope = ++_scope;
    if (!silent) {
      setState(() {
        _statsLoading = true;
        _statsError = false;
      });
    }
    final r = _range;
    try {
      final s = await getIt<SupportTicketRepository>().stats(
        dateFrom: r.from,
        dateTo: r.to,
      );
      if (!mounted || scope != _scope) return;
      setState(() {
        _stats = s;
        _statsLoading = false;
        _statsError = false;
      });
    } catch (_) {
      if (!mounted || scope != _scope) return;
      if (!silent) {
        setState(() {
          _statsLoading = false;
          _statsError = true;
        });
      }
    }
  }

  Future<void> _refresh() async {
    if (!_access.ticketsEnabled) return;
    await Future.wait([_list.load(), _loadStats(silent: true)]);
  }

  void _setPeriod(IncomePeriod p) {
    _period = p;
    _stats = null;
    _loadStats();
  }

  Future<void> _pickCustom() async {
    final now = DateTime.now();
    final r = _range;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _period == IncomePeriod.custom
          ? _custom
          : DateTimeRange(
              start: DateTime.parse(r.from),
              end: DateTime.parse(r.to),
            ),
    );
    if (picked == null) return;
    _custom = picked;
    _period = IncomePeriod.custom;
    _stats = null;
    _loadStats();
  }

  String get _customLabel {
    final c = _custom;
    if (c == null) return 'Custom…';
    return '${dayMonth(c.start)} – ${dayMonth(c.end)}';
  }

  void _setStatus(String v) {
    if (v == _status) return;
    setState(() => _status = v);
    _list.load();
  }

  Future<void> _create() async {
    final saved = await context.push<bool>(AppRoutes.supportTicketForm);
    if (saved == true && mounted) _refresh();
  }

  Future<void> _open(SupportTicket t) async {
    await context.push(AppRoutes.supportTicketDetail, extra: t.id);
    if (mounted) _refresh();
  }

  // ── build ─────────────────────────────────────────────────────────────────

  Widget _hero(double top) {
    final s = _stats;
    return ListHero(
      title: 'Support',
      subtitle: 'Find quick answers, raise a ticket and follow it until the '
          '${context.watch<PlatformConfigCubit>().state.appName} team has it '
          'sorted.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        ListHeroButton(
          icon: Icons.mail_outline_rounded,
          onTap: () => contactSupport(context),
        ),
        if (_access.canRaise)
          ListHeroButton(icon: Icons.add_rounded, onTap: _create),
      ],
      chips: [
        if (s != null && _access.ticketsEnabled && !_statsError) ...[
          ListHeroChip(
            icon: Icons.radio_button_checked_rounded,
            label: '${s.open} open',
          ),
          ListHeroChip(
            icon: Icons.schedule_rounded,
            label: '${s.inProgress} in progress',
          ),
          ListHeroChip(
            icon: Icons.check_circle_outline_rounded,
            label: '${s.resolved} resolved',
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final showInsights = _access.ticketsEnabled && !_statsError;
    return BlocProvider<PaginatedListCubit<SupportTicket>>.value(
      value: _list,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: RefreshIndicator(
          color: AppColors.staffB,
          backgroundColor: AppColors.surface2,
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(child: _hero(top)),
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (showInsights) ...[
                          IncomePeriodBar(
                            period: _period,
                            customLabel: _customLabel,
                            onPeriod: _setPeriod,
                            onCustom: _pickCustom,
                            compare: _compare,
                            onCompare: (v) => setState(() => _compare = v),
                          ),
                          if (_compare && _rangeReady) ...[
                            const SizedBox(height: 8),
                            _compareNote(),
                          ],
                          const SizedBox(height: 14),
                          if (_stats != null) ...[
                            SupportKpis(
                              stats: _stats!,
                              compare: _compare,
                              previousLabel: _previousLabel,
                            ),
                            const SizedBox(height: 14),
                          ],
                          SupportInsights(
                            stats: _stats,
                            loading: _statsLoading,
                            compare: _compare,
                            previousLabel: _previousLabel,
                          ),
                          const SizedBox(height: 12),
                        ],
                        const SupportHelpCentre(),
                        const SizedBox(height: 14),
                        if (_access.ticketsEnabled) _controls(),
                      ],
                    ),
                  ),
                ),
              ),
              if (!_access.hasPlan)
                const SliverToBoxAdapter(
                  child: SizedBox(
                    height: 260,
                    child: AppEmptyState(
                      icon: Icons.support_agent_outlined,
                      title: 'Not on your plan',
                      message:
                          'Upgrade your subscription to unlock support tickets.',
                    ),
                  ),
                )
              else if (!_access.canView)
                const SliverToBoxAdapter(
                  child: SizedBox(
                    height: 260,
                    child: AppEmptyState(
                      icon: Icons.support_agent_outlined,
                      title: 'No access',
                      message:
                          "You don't have permission to view support tickets.",
                    ),
                  ),
                )
              else
                _body(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _compareNote() {
    final p = previousRange(_range.from, _range.to);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        'Previous period: ${analyticsShortDate(p.from)} – '
        '${analyticsShortDate(p.to)}.',
        style: AppText.body(
          size: 11.5,
          color: AppColors.inkFaint,
          weight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _controls() {
    return ValueListenableBuilder<SupportTicketCounts?>(
      valueListenable: _counts,
      builder: (context, counts, _) {
        int? count(String s) => switch (s) {
              '' => counts?.all,
              'OPEN' => counts?.open,
              'IN_PROGRESS' => counts?.inProgress,
              'RESOLVED' => counts?.resolved,
              'CLOSED' => counts?.closed,
              _ => null,
            };
        Widget chip(String value, String label, Color color) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TeamFilterChip(
                label:
                    count(value) == null ? label : '$label · ${count(value)}',
                selected: _status == value,
                color: color,
                onTap: () => _setStatus(value),
              ),
            );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Support tickets', style: AppText.display(size: 18)),
            const SizedBox(height: 2),
            Text(
              'Track and raise issues directly with our team.',
              style: AppText.body(
                size: 12,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  chip('', 'All', kSupportColor),
                  for (final st in kTicketStatuses)
                    chip(st, ticketStatusLabel(st), ticketStatusColor(st)),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
        );
      },
    );
  }

  Widget _body() {
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
              child: AppEmptyState(
                icon: Icons.support_agent_outlined,
                title: _status.isEmpty
                    ? 'No tickets yet'
                    : 'No ${ticketStatusLabel(_status).toLowerCase()} tickets',
                message: _status.isEmpty
                    ? 'Raise one if you run into an issue.'
                    : 'Try another status.',
              ),
            ),
          ),
        PaginatedListLoaded(
          :final items,
          :final hasMore,
          :final loadingMore,
        ) =>
          SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < items.length; i++)
                      FadeUp(
                        index: i.clamp(0, 6),
                        child: _TicketCard(
                          ticket: items[i],
                          onTap: () => _open(items[i]),
                        ),
                      ),
                    if (hasMore)
                      Center(
                        child: LoadMoreButton(
                          loading: loadingMore,
                          onPressed: _list.loadMore,
                          shownCount: items.length,
                          totalCount:
                              _total < items.length ? items.length : _total,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
      },
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket, required this.onTap});

  final SupportTicket ticket;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = ticket;
    final bar = ticketPriorityColor(t.priority);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(width: 6, color: bar),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: kSupportColor.withValues(alpha: 0.16),
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                supportInitials(
                                  t.createdByName ?? t.createdByEmail,
                                ),
                                style: AppText.body(
                                  size: 11.5,
                                  weight: FontWeight.w800,
                                  color: kSupportColor,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                t.subject,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 14,
                                  weight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: AppColors.inkFaint,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          t.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 12.5,
                            color: AppColors.inkSoft,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            TeamTag(
                              label: t.priority.label,
                              color: bar,
                              icon: ticketPriorityIcon(t.priority),
                            ),
                            TeamTag(
                              label: ticketStatusLabel(t.status),
                              color: ticketStatusColor(t.status),
                              icon: ticketStatusIcon(t.status),
                            ),
                            Text(
                              'Raised ${supportAgo(t.createdAt)} · '
                              '${fmtDate(t.createdAt)}',
                              style: AppText.body(
                                size: 11,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
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

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/notification_stats.dart';
import '../../../models/tenant_notification.dart';
import '../../../repositories/tenant_notification_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/comm_kit.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../income/presentation/income_filters.dart';
import '../../income/presentation/income_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../reports/presentation/analytics/analytics_logic.dart'
    show analyticsShortDate, previousRange;
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'notification_ui.dart';
import 'widgets/notification_insights.dart';

/// Notifications — web's `/notifications` page (the Inbox tab), redesigned
/// for the phone and tablet.
///
/// Same order as web: a gradient hero (Unread / Received this period / Read
/// rate chips, Mark all read), the route tabs (Inbox / Message log /
/// Settings), the Period bar (period chips incl. Custom, Compare — there is no
/// branch: the feed is tenant-wide), four KPI tiles, the insights (volume,
/// read rate, by category, activity by hour — all from `GET
/// /notifications/stats`), then the Inbox: Unread / All switch with counts,
/// search, category chips (counts = the selected period, like web) and the
/// feed grouped under Today / Yesterday / date headings with Load more.
/// Every inbox filter is a server parameter (`unreadOnly`, `category`,
/// `search`), so it covers the whole feed, not just the loaded page.
///
/// Read state is tenant-wide (one `readAt` shared by every staff user): "Mark
/// all read" and the Unread KPI say so. Tapping an unread row marks it read.
///
/// Gating (see [NotificationAccess]): the menu tiles / route are unchanged;
/// like web's page the screen needs `notifications:view` (else "No access to
/// notifications" and no request); the per-row Delete needs
/// `notifications:manage` and is hidden without it; the Settings tab needs
/// `notifications:manage`.
///
/// **Dropped vs web**: numbered pagination (Load more replaces it), chart
/// hover tooltips (tap / drag inspection), and live Socket.IO push — new
/// notifications appear on pull-to-refresh, as before.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

enum _InboxView { unread, all }

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final NotificationAccess _access;
  late final PaginatedListCubit<TenantNotification> _list;
  final ValueNotifier<NotificationCounts?> _counts = ValueNotifier(null);

  // Period / compare (web's `useNotificationControls`; no branch).
  IncomePeriod _period = IncomePeriod.thisMonth;
  DateTimeRange? _custom;
  bool _compare = true;

  // Stats.
  NotificationStats? _stats;
  bool _statsLoading = true;
  bool _statsError = false;
  int _scope = 0;

  // Inbox filters.
  _InboxView _view = _InboxView.unread;
  String _category = '';
  String _search = '';

  bool _markingAll = false;
  final Set<String> _busy = {};

  ({String from, String to}) get _range => incomeRange(_period, _custom);
  bool get _rangeReady => _range.from.compareTo(_range.to) <= 0;

  @override
  void initState() {
    super.initState();
    _access = NotificationAccess.of(context);
    final repo = getIt<TenantNotificationRepository>();
    _list = PaginatedListCubit<TenantNotification>((page) async {
      final r = await repo.listWithCounts(
        page: page,
        category: _category.isEmpty ? null : _category,
        unreadOnly: _view == _InboxView.unread,
        search: _search,
      );
      if (r.counts != null) _counts.value = r.counts;
      return r.page;
    });
    if (_access.canView) {
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
      final s = await getIt<TenantNotificationRepository>().stats(
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
      // A silent refresh keeps the numbers on screen; a real load shows the
      // error card (web shows the failure once, quietly, in the chart cards).
      if (!silent) {
        setState(() {
          _statsLoading = false;
          _statsError = true;
        });
      }
    }
  }

  Future<void> _refresh() async {
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

  String get _previousLabel => _period.previousLabel;

  void _setView(_InboxView v) {
    if (v == _view) return;
    setState(() => _view = v);
    _list.load();
  }

  void _setCategory(String c) {
    if (c == _category) return;
    setState(() => _category = c);
    _list.load();
  }

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      await getIt<TenantNotificationRepository>().markAllRead();
      if (!mounted) return;
      teamSnack(context, 'All notifications marked as read.');
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not mark all read ($e)', error: true);
      }
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  Future<void> _markRead(TenantNotification n) async {
    if (!n.isUnread || _busy.contains(n.id)) return;
    setState(() => _busy.add(n.id));
    try {
      await getIt<TenantNotificationRepository>().markRead(n.id);
      if (!mounted) return;
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (_) {
      // Non-fatal — the row stays as it was.
    } finally {
      if (mounted) setState(() => _busy.remove(n.id));
    }
  }

  Future<void> _delete(TenantNotification n) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete this notification?',
      message: 'It is removed from the inbox for your whole team.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      await getIt<TenantNotificationRepository>().delete(n.id);
      if (!mounted) return;
      teamSnack(context, 'Notification deleted.');
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          'Could not delete the notification ($e)',
          error: true,
        );
      }
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    if (!_access.canView) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            _hero(top),
            const Expanded(
              child: AppEmptyState(
                icon: Icons.notifications_off_outlined,
                title: 'No access to notifications',
                message: "You don't have permission to view notifications.",
              ),
            ),
          ],
        ),
      );
    }
    return BlocProvider<PaginatedListCubit<TenantNotification>>.value(
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
                        NotificationTabs(
                          active: NotificationPage.inbox,
                          access: _access,
                        ),
                        const SizedBox(height: 12),
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
                        // Zeroed tiles would mislead on a failed load: web
                        // shows the failure in the chart cards instead.
                        if (_stats != null && !_statsError) ...[
                          NotificationKpis(
                            stats: _stats!,
                            compare: _compare,
                            previousLabel: _previousLabel,
                          ),
                          const SizedBox(height: 14),
                        ],
                        NotificationInsights(
                          stats: _stats,
                          loading: _statsLoading,
                          error: _statsError,
                          compare: _compare,
                          previousLabel: _previousLabel,
                          onRetry: _loadStats,
                        ),
                        const SizedBox(height: 4),
                        _inboxControls(),
                        const SizedBox(height: 10),
                      ],
                    ),
                  ),
                ),
              ),
              _feed(),
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

  Widget _hero(double top) {
    final s = _stats;
    return ListHero(
      title: 'Notifications',
      subtitle: 'Everything sent to your gym, in one place. Read status is '
          'shared by your whole team.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        if (_access.canView)
          ValueListenableBuilder<NotificationCounts?>(
            valueListenable: _counts,
            builder: (context, counts, _) {
              final unread = counts?.unread ?? s?.unread ?? 0;
              return Tooltip(
                message: 'Mark all read (shared by your whole team)',
                child: ListHeroButton(
                  icon: Icons.done_all_rounded,
                  onTap: (_markingAll || unread == 0) ? null : _markAllRead,
                ),
              );
            },
          ),
      ],
      chips: [
        if (s != null) ...[
          ListHeroChip(
            icon: Icons.notifications_active_rounded,
            label: '${s.unread} unread',
          ),
          ListHeroChip(
            icon: Icons.inbox_rounded,
            label: '${s.total.value.round()} received ${_period.noun}',
          ),
          ListHeroChip(
            icon: Icons.speed_rounded,
            label: '${(s.readRate.value * 100).round()}% read',
          ),
        ],
      ],
    );
  }

  // ── inbox ─────────────────────────────────────────────────────────────────

  Widget _inboxControls() {
    final byCat = {
      for (final c in _stats?.categories ?? const <NotificationCategoryStat>[])
        c.category: c.count,
    };
    final cats = kNotificationCategories
        .where((c) => _stats == null || (byCat[c] ?? 0) > 0 || c == _category)
        .toList()
      ..sort((a, b) => (byCat[b] ?? 0).compareTo(byCat[a] ?? 0));
    String withCount(String label, int? n) => n == null ? label : '$label · $n';
    return Container(
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
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [TeamColors.violet, TeamColors.indigo],
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.inbox_rounded,
                  size: 16,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Inbox', style: AppText.display(size: 16)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ValueListenableBuilder<NotificationCounts?>(
            valueListenable: _counts,
            builder: (context, counts, _) => CommSegmented<_InboxView>(
              color: TeamColors.violet,
              value: _view,
              onChanged: _setView,
              options: [
                (_InboxView.unread, withCount('Unread', counts?.unread)),
                (_InboxView.all, withCount('All', counts?.all)),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Everything sent to your gym. Read status is shared across your '
            'team.',
            style: AppText.body(
              size: 11.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          TeamSearchField(
            hint: 'Search notifications…',
            onSearch: (v) {
              if (v == _search) return;
              _search = v;
              _list.load();
              setState(() {});
            },
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _catChip('', 'All categories', null, TeamColors.violet),
                for (final c in cats)
                  _catChip(
                    c,
                    notifCategoryLabel(c),
                    _stats == null ? null : byCat[c] ?? 0,
                    notifCategoryColor(c),
                  ),
              ],
            ),
          ),
          if (_stats != null) ...[
            const SizedBox(height: 6),
            Text(
              'Category counts reflect the selected period; the list below '
              'covers all time.',
              style: AppText.body(
                size: 10.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _catChip(String value, String label, int? count, Color color) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: TeamFilterChip(
        label: count == null ? label : '$label · $count',
        selected: _category == value,
        color: color,
        onTap: () => _setCategory(value),
      ),
    );
  }

  Widget _feed() {
    return BlocBuilder<PaginatedListCubit<TenantNotification>,
        PaginatedListState<TenantNotification>>(
      builder: (context, state) => switch (state) {
        PaginatedListLoading() => const SliverToBoxAdapter(
            child: SizedBox(height: 220, child: AppLoadingView()),
          ),
        PaginatedListError(:final message) => SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: AppErrorView(
                message: message,
                onRetry: _list.load,
              ),
            ),
          ),
        PaginatedListLoaded(:final items) when items.isEmpty =>
          SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: AppEmptyState(
                icon: Icons.notifications_none_rounded,
                title: (_view == _InboxView.unread &&
                        _category.isEmpty &&
                        _search.isEmpty)
                    ? 'Nothing here'
                    : 'No matching notifications',
                message: (_view == _InboxView.unread &&
                        _category.isEmpty &&
                        _search.isEmpty)
                    ? "You're all caught up."
                    : 'Try a different filter or search.',
              ),
            ),
          ),
        PaginatedListLoaded(
          :final items,
          :final hasMore,
          :final loadingMore,
        ) =>
          _loaded(items, hasMore, loadingMore),
      },
    );
  }

  Widget _loaded(
    List<TenantNotification> items,
    bool hasMore,
    bool loadingMore,
  ) {
    // Day headings between rows, like web's grouped feed.
    final entries = <Object>[];
    String? last;
    for (final n in items) {
      final label = notifDayLabel(n.createdAt);
      if (label != last) {
        entries.add(label);
        last = label;
      }
      entries.add(n);
    }
    // The API's `counts` already reflect the category / search filters, so
    // the matching one is the total for the current Unread / All view.
    final counts = _counts.value;
    final total = (_view == _InboxView.unread ? counts?.unread : counts?.all) ??
        items.length;
    final rows = <Widget>[];
    var animIndex = 0;
    for (final e in entries) {
      if (e is String) {
        rows.add(TeamGroupLabel(e));
      } else if (e is TenantNotification) {
        rows.add(
          FadeUp(
            index: (animIndex++).clamp(0, 6),
            child: _NotificationTile(
              notification: e,
              busy: _busy.contains(e.id),
              canDelete: _access.canManage,
              onTap: () => _markRead(e),
              onDelete: () => _delete(e),
            ),
          ),
        );
      }
    }
    return SliverToBoxAdapter(
      child: TeamCenter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ...rows,
              if (hasMore)
                Center(
                  child: LoadMoreButton(
                    loading: loadingMore,
                    onPressed: _list.loadMore,
                    shownCount: items.length,
                    totalCount: total < items.length ? items.length : total,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.busy,
    required this.canDelete,
    required this.onTap,
    required this.onDelete,
  });

  final TenantNotification notification;
  final bool busy;
  final bool canDelete;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final tone = notifCategoryColor(n.category);
    final unread = n.isUnread;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        gradient: unread
            ? LinearGradient(
                colors: [tone.withValues(alpha: 0.10), Colors.transparent],
                stops: const [0, 0.65],
              )
            : null,
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: unread ? tone.withValues(alpha: 0.35) : AppColors.line,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (unread) Container(width: 4, color: tone),
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: unread ? onTap : null,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: tone.withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            notifCategoryIcon(n.category),
                            size: 19,
                            color: tone,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      n.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.body(
                                        size: 13.5,
                                        weight: unread
                                            ? FontWeight.w800
                                            : FontWeight.w600,
                                        color: unread
                                            ? AppColors.ink
                                            : AppColors.inkSoft,
                                      ),
                                    ),
                                  ),
                                  if (unread) ...[
                                    const SizedBox(width: 8),
                                    PulseDot(color: tone, size: 7),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                n.body,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 12,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                notifAgo(n.createdAt),
                                style: AppText.body(
                                  size: 10.5,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (unread)
                    IconButton(
                      tooltip: 'Mark as read',
                      visualDensity: VisualDensity.compact,
                      onPressed: busy ? null : onTap,
                      icon: busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              Icons.check_rounded,
                              size: 20,
                              color: AppColors.inkSoft,
                            ),
                    ),
                  if (canDelete)
                    IconButton(
                      tooltip: 'Delete notification',
                      visualDensity: VisualDensity.compact,
                      onPressed: onDelete,
                      icon: Icon(
                        Icons.delete_outline_rounded,
                        size: 20,
                        color: AppColors.danger,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

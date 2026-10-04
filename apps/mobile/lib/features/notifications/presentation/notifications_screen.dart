import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/common/period_stats_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/notification_stats.dart';
import '../../../models/tenant_notification.dart';
import '../../../repositories/tenant_notification_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import 'widgets/notification_insights_header.dart';

const _categoryIcons = {
  'PAYMENT': Icons.payments_outlined,
  'MEMBER': Icons.person_add_alt_outlined,
  'ATTENDANCE': Icons.qr_code_scanner_outlined,
  'SYSTEM': Icons.settings_outlined,
  'ANNOUNCEMENT': Icons.campaign_outlined,
  'SUPPORT': Icons.support_agent_outlined,
};

/// Filter chip keys: `all`, `unread`, or a real category API value.
const _filterAll = 'all';
const _filterUnread = 'unread';

/// Categories offered as chips (the staff-relevant ones); any other category
/// present in the insights is appended so nothing is unreachable.
const _chipCategories = [
  'PAYMENT',
  'MEMBER',
  'MEMBERSHIP',
  'ATTENDANCE',
  'SUBSCRIPTION',
  'ANNOUNCEMENT',
  'SYSTEM',
  'STAFF',
];

/// Design frame "17. Notifications" — an animated insights header
/// (`GET /notifications/stats`), All / Unread / per-category chips and a
/// search box that all use the SERVER-side `unreadOnly` / `category` /
/// `search` params (the old client-side-after-pagination filtering is gone),
/// then the feed with a per-row unread dot over `GET /notifications` +
/// mark-read/read-all. No Socket.IO live-push wiring, so new notifications
/// appear on pull-to-refresh.
///
/// Read state is tenant-wide: one `readAt` shared by every staff user, so
/// "Mark all read" clears the feed for the whole team — the button's
/// tooltip and the Unread KPI say so.
///
/// Chip counts: the API's `counts` block only has `all` and `unread`, so only
/// those two chips carry a number; per-category figures live in the
/// insights' "By category" block (they are period-scoped, so putting them on
/// all-time chips would mislead).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final PaginatedListCubit<TenantNotification> _list;
  late final NotificationStatsCubit _stats;
  final ValueNotifier<NotificationCounts?> _counts = ValueNotifier(null);
  bool _markingAll = false;
  String _filter = _filterAll;
  String _search = '';

  bool get _canViewStats {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff &&
        session.user.hasPermission('notifications:view');
  }

  @override
  void initState() {
    super.initState();
    final repo = getIt<TenantNotificationRepository>();
    _list = PaginatedListCubit<TenantNotification>((page) async {
      final r = await repo.listWithCounts(
        page: page,
        category: (_filter == _filterAll || _filter == _filterUnread)
            ? null
            : _filter,
        unreadOnly: _filter == _filterUnread,
        search: _search,
      );
      if (r.counts != null) _counts.value = r.counts;
      return r.page;
    })
      ..load();
    _stats = NotificationStatsCubit(repo.stats);
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

  void _setFilter(String f) {
    if (f == _filter) return;
    setState(() => _filter = f);
    _list.load();
  }

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      await getIt<TenantNotificationRepository>().markAllRead();
      if (!mounted) return;
      await _refresh(silentStats: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  Future<void> _tapNotification(TenantNotification n) async {
    if (n.isUnread) {
      try {
        await getIt<TenantNotificationRepository>().markRead(n.id);
        if (!mounted) return;
        await _refresh(silentStats: true);
      } on ApiException {
        // Non-fatal — the notification stays visible either way.
      }
    }
  }

  List<FilterChipOption<String>> _options(NotificationCounts? counts) {
    final extra = <String>[];
    final s = _stats.state;
    if (s is PeriodStatsLoaded<NotificationStats>) {
      for (final c in s.data.categories) {
        if (c.count > 0 && !_chipCategories.contains(c.category)) {
          extra.add(c.category);
        }
      }
    }
    return [
      FilterChipOption(_filterAll, 'All', count: counts?.all),
      FilterChipOption(_filterUnread, 'Unread', count: counts?.unread),
      for (final c in [..._chipCategories, ...extra])
        FilterChipOption(c, notificationCategoryLabel(c)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<PaginatedListCubit<TenantNotification>>.value(
          value: _list,
        ),
        BlocProvider<NotificationStatsCubit>.value(value: _stats),
      ],
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: ValueListenableBuilder<NotificationCounts?>(
            valueListenable: _counts,
            builder: (context, counts, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${counts?.unread ?? 0} unread',
                  style: AppText.eyebrow(),
                ),
                Text('Notifications', style: AppText.display(size: 18)),
              ],
            ),
          ),
          actions: [
            Tooltip(
              message: 'Read status is shared by all staff',
              child: TextButton(
                onPressed: _markingAll ? null : _markAllRead,
                child: Text(
                  'Mark all read',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.staffPillFg,
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
                sliver: SliverToBoxAdapter(
                  child: NotificationInsightsHeader(),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ValueListenableBuilder<NotificationCounts?>(
                        valueListenable: _counts,
                        builder: (context, counts, _) => FilterChipsRow<String>(
                          options: _options(counts),
                          selected: _filter,
                          onSelected: _setFilter,
                        ),
                      ),
                      const SizedBox(height: 10),
                      DebouncedSearchField(
                        hint: 'Search notifications',
                        onChanged: (v) {
                          if (v == _search) return;
                          _search = v;
                          _list.load();
                        },
                      ),
                    ],
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
    return BlocBuilder<PaginatedListCubit<TenantNotification>,
        PaginatedListState<TenantNotification>>(
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
                icon: Icons.notifications_none_rounded,
                title: _filter == _filterAll && _search.isEmpty
                    ? 'No notifications yet'
                    : 'Nothing matches',
                message: _filter == _filterUnread
                    ? "You're all caught up."
                    : 'Try another filter or search.',
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
                return _NotificationTile(
                  notification: items[i],
                  onTap: () => _tapNotification(items[i]),
                );
              },
            ),
          ),
      },
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final TenantNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = notification.isUnread;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: unread ? AppColors.staffSoft : AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(
              color: unread ? AppColors.staffPillFg : AppColors.line,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppColors.surface3,
                  borderRadius: BorderRadius.circular(AppRadii.tile),
                ),
                alignment: Alignment.center,
                child: Icon(
                  _categoryIcons[notification.category] ??
                      Icons.notifications_outlined,
                  size: 17,
                  color: AppColors.inkSoft,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notification.body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _relativeTime(notification.createdAt),
                      style: AppText.body(
                        size: 10.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (unread)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: const BoxDecoration(
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _relativeTime(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${d.day}/${d.month}/${d.year}';
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_notification.dart';
import '../../../repositories/member_notification_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';

const _categoryIcons = {
  'MEMBERSHIP': Icons.card_membership_outlined,
  'PAYMENT': Icons.payments_outlined,
  'WORKOUT': Icons.fitness_center_outlined,
  'DIET': Icons.restaurant_outlined,
  'ATTENDANCE': Icons.qr_code_scanner_outlined,
  'ANNOUNCEMENT': Icons.campaign_outlined,
  'MEMBER': Icons.celebration_outlined,
};

/// Member-plane counterpart to the staff `NotificationsScreen` — same
/// `GET .../notifications` + mark-read/read-all shape, over
/// `/portal/notifications*` instead. Always `AppRole.member` themed (lime →
/// teal), never the staff coral/violet. Filter chips (All / Unread plus the
/// categories a member actually receives) use the server's `unreadOnly` and
/// `category` params — never filtered client-side after pagination. The
/// app-bar unread figure is the server's `unreadCount`, not a count of the
/// loaded page.
///
/// Dropped vs the staff screen: per-chip count badges and the period
/// insights header — the member endpoints return only a single unread total,
/// no per-category counts or stats.
class MemberNotificationsScreen extends StatefulWidget {
  const MemberNotificationsScreen({super.key});

  @override
  State<MemberNotificationsScreen> createState() =>
      _MemberNotificationsScreenState();
}

/// Chip values: 'ALL', 'UNREAD', or a server category.
const _filterOptions = <FilterChipOption<String>>[
  FilterChipOption('ALL', 'All'),
  FilterChipOption('UNREAD', 'Unread'),
  FilterChipOption('MEMBERSHIP', 'Membership'),
  FilterChipOption('PAYMENT', 'Payments'),
  FilterChipOption('WORKOUT', 'Workout'),
  FilterChipOption('DIET', 'Diet'),
  FilterChipOption('ATTENDANCE', 'Attendance'),
  FilterChipOption('ANNOUNCEMENT', 'Announcements'),
];

class _MemberNotificationsScreenState extends State<MemberNotificationsScreen> {
  String _filter = 'ALL';
  int? _unread;
  bool _markingAll = false;
  late final PaginatedListCubit<TenantNotification> _list =
      PaginatedListCubit<TenantNotification>(
    (page) => getIt<MemberNotificationRepository>().list(
      page: page,
      unreadOnly: _filter == 'UNREAD',
      category: _filter == 'ALL' || _filter == 'UNREAD' ? null : _filter,
    ),
  )..load();

  @override
  void initState() {
    super.initState();
    _refreshUnread();
  }

  @override
  void dispose() {
    _list.close();
    super.dispose();
  }

  Future<void> _refreshUnread() async {
    try {
      final n = await getIt<MemberNotificationRepository>().unreadCount();
      if (mounted) setState(() => _unread = n);
    } on ApiException {
      // Non-fatal — the title just omits the number.
    }
  }

  Future<void> _reload() async {
    unawaited(_refreshUnread());
    await _list.load();
  }

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      await getIt<MemberNotificationRepository>().markAllRead();
      if (!mounted) return;
      await _reload();
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
        await getIt<MemberNotificationRepository>().markRead(n.id);
        if (!mounted) return;
        await _reload();
      } on ApiException {
        // Non-fatal — the notification stays visible either way.
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('${_unread ?? 0} unread', style: AppText.eyebrow()),
            Text('Notifications', style: AppText.display(size: 18)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: _markingAll ? null : _markAllRead,
            child: Text(
              'Mark all read',
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.memberPillFg,
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 8),
            child: FilterChipsRow<String>(
              options: _filterOptions,
              selected: _filter,
              role: AppRole.member,
              onSelected: (v) {
                if (v == _filter) return;
                setState(() => _filter = v);
                _list.load();
              },
            ),
          ),
          Expanded(
            child: BlocBuilder<PaginatedListCubit<TenantNotification>,
                PaginatedListState<TenantNotification>>(
              bloc: _list,
              builder: (context, state) {
                return switch (state) {
                  PaginatedListLoading() =>
                    const AppLoadingView(role: AppRole.member),
                  PaginatedListError(:final message) => AppErrorView(
                      message: message,
                      role: AppRole.member,
                      onRetry: _list.load,
                    ),
                  PaginatedListLoaded(:final items) when items.isEmpty =>
                    AppEmptyState(
                      icon: Icons.notifications_none_rounded,
                      title: _filter == 'ALL'
                          ? 'No notifications yet'
                          : 'Nothing here',
                      message: _filter == 'ALL'
                          ? 'Updates about your membership, payments, '
                              'workouts and gym announcements will show up '
                              'here.'
                          : 'No notifications match this filter.',
                    ),
                  PaginatedListLoaded(
                    :final items,
                    :final hasMore,
                    :final loadingMore,
                  ) =>
                    RefreshIndicator(
                      color: AppColors.memberB,
                      backgroundColor: AppColors.surface2,
                      onRefresh: _reload,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                        itemCount: items.length + (hasMore ? 1 : 0),
                        itemBuilder: (context, i) {
                          if (i == items.length) {
                            return Center(
                              child: loadingMore
                                  ? const Padding(
                                      padding: EdgeInsets.all(12),
                                      child: CircularProgressIndicator(
                                        color: AppColors.memberB,
                                      ),
                                    )
                                  : TextButton(
                                      onPressed: _list.loadMore,
                                      child: const Text('Load more'),
                                    ),
                            );
                          }
                          return _MemberNotificationTile(
                            notification: items[i],
                            onTap: () => _tapNotification(items[i]),
                          );
                        },
                      ),
                    ),
                };
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _MemberNotificationTile extends StatelessWidget {
  const _MemberNotificationTile({
    required this.notification,
    required this.onTap,
  });

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
            color: unread ? AppColors.memberSoft : AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(
              color: unread ? AppColors.memberPillFg : AppColors.line,
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
                    gradient: AppColors.memberGrad,
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

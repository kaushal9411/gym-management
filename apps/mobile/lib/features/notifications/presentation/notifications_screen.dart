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
import '../../../repositories/tenant_notification_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

const _categoryIcons = {
  'PAYMENT': Icons.payments_outlined,
  'MEMBER': Icons.person_add_alt_outlined,
  'ATTENDANCE': Icons.qr_code_scanner_outlined,
  'SYSTEM': Icons.settings_outlined,
  'ANNOUNCEMENT': Icons.campaign_outlined,
  'SUPPORT': Icons.support_agent_outlined,
};

/// The design's filter pills. `GET /notifications` takes no category
/// query param (only `unreadOnly`/paging), so filtering is applied to the
/// fetched page client-side on each item's real `category`.
enum _NotificationFilter { all, payments, members }

extension _NotificationFilterX on _NotificationFilter {
  String get label => switch (this) {
        _NotificationFilter.all => 'All',
        _NotificationFilter.payments => 'Payments',
        _NotificationFilter.members => 'Members',
      };

  bool matches(TenantNotification n) => switch (this) {
        _NotificationFilter.all => true,
        _NotificationFilter.payments => n.category == 'PAYMENT',
        _NotificationFilter.members =>
          n.category == 'MEMBER' || n.category == 'MEMBERSHIP',
      };
}

/// Design frame "17. Notifications" — unread count, All/Payments/Members
/// filter pills and a per-row unread dot, over `GET /notifications` +
/// mark-read/read-all. No Socket.IO live-push wiring in this pass, so new
/// notifications appear on pull-to-refresh rather than instantly.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<TenantNotification>>(
      create: (_) => PaginatedListCubit<TenantNotification>(
        (page) => getIt<TenantNotificationRepository>().list(page: page),
      )..load(),
      child: const _NotificationsView(),
    );
  }
}

class _NotificationsView extends StatefulWidget {
  const _NotificationsView();

  @override
  State<_NotificationsView> createState() => _NotificationsViewState();
}

class _NotificationsViewState extends State<_NotificationsView> {
  bool _markingAll = false;
  _NotificationFilter _filter = _NotificationFilter.all;

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      await getIt<TenantNotificationRepository>().markAllRead();
      if (!mounted) return;
      context.read<PaginatedListCubit<TenantNotification>>().load();
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
        context.read<PaginatedListCubit<TenantNotification>>().load();
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
        title: BlocBuilder<PaginatedListCubit<TenantNotification>,
            PaginatedListState<TenantNotification>>(
          builder: (context, state) {
            final unread = state is PaginatedListLoaded<TenantNotification>
                ? state.items.where((n) => n.isUnread).length
                : 0;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$unread unread', style: AppText.eyebrow()),
                Text('Notifications', style: AppText.display(size: 18)),
              ],
            );
          },
        ),
        actions: [
          TextButton(
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
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 10),
            child: Row(
              children: _NotificationFilter.values.map((f) {
                final selected = f == _filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => setState(() => _filter = f),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        gradient: selected ? AppColors.staffGrad : null,
                        color: selected ? null : AppColors.surface3,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        f.label,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color:
                              selected ? Colors.white : AppColors.inkSoft,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(child: _buildList()),
        ],
      ),
    );
  }

  Widget _buildList() {
    return BlocBuilder<PaginatedListCubit<TenantNotification>,
        PaginatedListState<TenantNotification>>(
      builder: (context, state) {
        final filtered = state is PaginatedListLoaded<TenantNotification>
            ? state.items.where(_filter.matches).toList()
            : const <TenantNotification>[];
        return switch (state) {
          PaginatedListLoading() => const AppLoadingView(),
          PaginatedListError(:final message) => AppErrorView(
              message: message,
              onRetry: () => context
                  .read<PaginatedListCubit<TenantNotification>>()
                  .load(),
            ),
          PaginatedListLoaded() when filtered.isEmpty => AppEmptyState(
              icon: Icons.notifications_none_rounded,
              title: _filter == _NotificationFilter.all
                  ? 'No notifications yet'
                  : 'Nothing under ${_filter.label}',
              message: "You're all caught up.",
            ),
          PaginatedListLoaded() => RefreshIndicator(
              color: AppColors.staffB,
              backgroundColor: AppColors.surface2,
              onRefresh: () => context
                  .read<PaginatedListCubit<TenantNotification>>()
                  .load(),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                itemCount: filtered.length,
                itemBuilder: (context, i) => _NotificationTile(
                  notification: filtered[i],
                  onTap: () => _tapNotification(filtered[i]),
                ),
              ),
            ),
        };
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

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/di/service_locator.dart';
import '../../core/routing/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../repositories/member_notification_repository.dart';
import '../../repositories/tenant_notification_repository.dart';

/// Bell icon + unread-count badge shown next to the profile avatar on every
/// role's header — the mobile counterpart to tenant-web's `NotificationPanel`
/// (`components/layout/header.tsx`), minus the inline drawer, since mobile
/// already has a dedicated Notifications screen per plane
/// (`AppRoutes.notifications` / `AppRoutes.memberNotifications`) to push to
/// instead. Polls on a 60s timer while mounted — same cadence as web's
/// `useNotifications` `refetchInterval` — and also refreshes right after a
/// visit to the notification list, so marking things read reflects back
/// without waiting out the full interval.
class NotificationBellIcon extends StatefulWidget {
  const NotificationBellIcon({required this.isStaff, super.key, this.size = 38});

  final bool isStaff;
  final double size;

  @override
  State<NotificationBellIcon> createState() => _NotificationBellIconState();
}

class _NotificationBellIconState extends State<NotificationBellIcon> {
  int _unreadCount = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _fetch();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) => _fetch());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    try {
      final count = widget.isStaff
          ? await getIt<TenantNotificationRepository>().unreadCount()
          : await getIt<MemberNotificationRepository>().unreadCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {
      // Best-effort — a failed poll just keeps the last known count on screen.
    }
  }

  Future<void> _onTap() async {
    await context.push(
      widget.isStaff ? AppRoutes.notifications : AppRoutes.memberNotifications,
    );
    _fetch();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              decoration: const BoxDecoration(
                color: AppColors.surface2,
                shape: BoxShape.circle,
                border: Border.fromBorderSide(
                  BorderSide(color: AppColors.line),
                ),
              ),
              alignment: Alignment.center,
              child: Icon(
                Icons.notifications_outlined,
                color: AppColors.ink,
                size: widget.size * 0.5,
              ),
            ),
            if (_unreadCount > 0)
              Positioned(
                top: -4,
                right: -4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: AppColors.bg, width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    _unreadCount > 99 ? '99+' : '$_unreadCount',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

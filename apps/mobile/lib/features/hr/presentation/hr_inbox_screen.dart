import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/routing/hr_notification_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/hr_leave.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import 'hr_palette.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

IconData _icon(String type) => switch (type) {
      'LEAVE_APPROVED' => Icons.check_circle_rounded,
      'LEAVE_REJECTED' => Icons.cancel_rounded,
      'LEAVE_CANCELLED' => Icons.block_rounded,
      'LEAVE_APPLIED' => Icons.event_note_rounded,
      'PAYSLIP_PAID' => Icons.payments_rounded,
      _ => Icons.notifications_rounded,
    };

Color _color(String type) => switch (type) {
      'LEAVE_APPROVED' => HrPalette.approved,
      'LEAVE_REJECTED' => HrPalette.rejected,
      'LEAVE_CANCELLED' => HrPalette.cancelled,
      'LEAVE_APPLIED' => HrPalette.pending,
      'PAYSLIP_PAID' => HrPalette.paid,
      _ => HrPalette.onLeave,
    };

/// **HR updates** - the employee's own HR inbox (`GET /hr/me/notifications`,
/// `hr:self_leave`): leave decisions with the approver's remark, payslips
/// being paid, and (for approvers) new / cancelled requests. This is its own
/// feed - the tenant-wide Notification Center is shared by all staff, so the
/// API deliberately keeps leave and salary news out of it.
class HrInboxScreen extends StatefulWidget {
  const HrInboxScreen({super.key});

  @override
  State<HrInboxScreen> createState() => _HrInboxScreenState();
}

class _HrInboxScreenState extends State<HrInboxScreen> {
  int _unread = 0;
  late final PaginatedListCubit<HrNotification> _cubit =
      PaginatedListCubit<HrNotification>((page) async {
    final r = await getIt<HrRepository>().myNotifications(page: page);
    if (mounted) setState(() => _unread = r.unreadCount);
    return r.page;
  })
        ..load();

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  Future<void> _readAll() async {
    try {
      await getIt<HrRepository>().markAllNotificationsRead();
      if (mounted) _cubit.load();
    } on ApiException catch (e) {
      if (mounted) hrSnack(context, e.message, error: true);
    }
  }

  Future<void> _open(HrNotification n) async {
    if (n.isUnread) {
      try {
        await getIt<HrRepository>().markNotificationRead(n.id);
      } on ApiException {
        // Reading is best-effort; still navigate.
      }
    }
    if (!mounted) return;
    final route = hrRouteForNotification(n.type);
    // Approver-only destinations need the key; fall back to My leaves.
    final canApprove = hrCan(context, HrPerm.leaveManage);
    await context.push<void>(
      route == AppRoutes.hrApprovals && !canApprove
          ? AppRoutes.hrMyLeaves
          : route,
    );
    if (mounted) _cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<HrNotification>>.value(
      value: _cubit,
      child: BlocBuilder<PaginatedListCubit<HrNotification>,
          PaginatedListState<HrNotification>>(
        builder: (context, state) {
          return HrPage(
            title: 'HR updates',
            subtitle: 'Leave decisions, remarks and payslips',
            onRefresh: _cubit.load,
            chips: [
              ListHeroChip(
                icon: Icons.mark_email_unread_rounded,
                label: '$_unread unread',
              ),
            ],
            trailing: [
              if (_unread > 0)
                ListHeroButton(icon: Icons.done_all_rounded, onTap: _readAll),
            ],
            slivers: hrPagedSlivers<HrNotification>(
              context,
              state,
              cubit: _cubit,
              emptyTitle: 'Nothing new',
              emptyMessage: 'Leave decisions and payslip alerts show up here.',
              emptyIcon: Icons.notifications_none_rounded,
              skeletonHeight: 78,
              itemBuilder: (context, n, i) => _NotificationRow(
                n: n,
                onTap: () => _open(n),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.n, required this.onTap});

  final HrNotification n;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = _color(n.type);
    return Semantics(
      button: true,
      label: '${n.isUnread ? 'Unread. ' : ''}${n.title}. ${n.body}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: n.isUnread ? c.withValues(alpha: 0.08) : AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(
                color: n.isUnread ? c.withValues(alpha: 0.4) : AppColors.line,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: c.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(_icon(n.type), color: c, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              n.title,
                              style: AppText.body(
                                size: 13.5,
                                weight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (n.isUnread)
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: c,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        n.body,
                        style: AppText.body(
                          size: 12.5,
                          color: AppColors.inkSoft,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${hrDate(hrToIst(n.createdAt))} · '
                        '${hrTime(hrToIst(n.createdAt))}',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
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
    );
  }
}

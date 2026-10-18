import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_drawer.dart';
import '../../../shared/widgets/menu_entry.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';

const _entries = [
  MenuEntry(
    icon: Icons.calendar_month_outlined,
    title: 'My Attendance',
    subtitle: 'Visit history',
    route: AppRoutes.memberAttendance,
  ),
  MenuEntry(
    icon: Icons.notifications_none_rounded,
    title: 'Notifications',
    subtitle: 'Membership, payments, and gym updates',
    route: AppRoutes.memberNotifications,
  ),
  MenuEntry(
    icon: Icons.receipt_long_outlined,
    title: 'Invoices',
    subtitle: 'Payment history',
    route: AppRoutes.memberInvoices,
  ),
  MenuEntry(
    icon: Icons.payments_outlined,
    title: 'Payments',
    subtitle: 'Receipts and refunds',
    route: AppRoutes.memberPayments,
  ),
  MenuEntry(
    icon: Icons.straighten_outlined,
    title: 'Body Measurements',
    subtitle: 'Your progress over time',
    route: AppRoutes.memberMeasurements,
  ),
  MenuEntry(
    icon: Icons.storefront_outlined,
    title: 'Gym info',
    subtitle: 'Hours, address and contact',
    route: AppRoutes.memberGymInfo,
  ),
  MenuEntry(
    icon: Icons.brightness_6_outlined,
    title: 'Appearance',
    subtitle: 'Light or dark theme',
    route: AppRoutes.appearance,
  ),
  MenuEntry(
    icon: Icons.download_outlined,
    title: 'Download my data',
    subtitle: 'GDPR export',
    route: AppRoutes.memberDataExport,
  ),
];

/// Design frame "8. Menu" (Profile is no longer a row: the avatar / name
/// header here and the avatar on the dashboard open My Profile), plus a "Body Measurements" tile added alongside
/// the mobile permission-parity work (not in the original design frame —
/// it's the natural member-facing counterpart of the trainer/owner-side
/// "Record measurement" flow on `member_detail_screen.dart`, real backend
/// data via `GET /portal/measurements`, same "add beyond the frame with a
/// doc comment" precedent used for the other roles' menu parity).
class MemberMenuScreen extends StatelessWidget {
  const MemberMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final name =
        session is SessionAuthenticatedMember ? session.member.name : '';
    final photoUrl = session is SessionAuthenticatedMember
        ? session.member.profilePhotoUrl
        : null;

    return AppDrawer(
      role: AppRole.member,
      avatarUrl: photoUrl,
      name: name,
      subtitle: 'Member',
      sections: const {'': _entries},
      onHeaderTap: () {
        SlideDrawerController.of(context)?.close();
        context.push(AppRoutes.memberProfile);
      },
      onSignOut: () => showMemberLogoutDialog(context),
    );
  }
}

/// Design frame "8g. Log out" — a confirm step, since signing back in
/// needs the Member ID.
Future<void> showMemberLogoutDialog(BuildContext context) async {
  final appName = context.read<PlatformConfigCubit>().state.appName;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: AppColors.surface2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      title: Text('Log out of $appName?', style: AppText.display(size: 18)),
      content: Text(
        "You'll need your Member ID to sign back in.",
        style: AppText.body(size: 13, color: AppColors.inkFaint),
      ),
      actions: [
        TextButton(
          onPressed: () => dialogContext.pop(false),
          child: Text(
            'Cancel',
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
        ),
        TextButton(
          onPressed: () => dialogContext.pop(true),
          child: Text(
            'Log out',
            style: AppText.body(
              size: 13,
              weight: FontWeight.w700,
              color: AppColors.danger,
            ),
          ),
        ),
      ],
    ),
  );
  if (confirmed == true && context.mounted) {
    await context.read<SessionCubit>().signOut();
  }
}

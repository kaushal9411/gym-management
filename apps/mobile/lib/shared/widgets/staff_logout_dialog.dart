import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../bloc/platform/platform_config_cubit.dart';
import '../../bloc/session/session_cubit.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

/// Staff-plane counterpart of `member_menu_screen.dart`'s
/// `showMemberLogoutDialog` — same confirm-then-sign-out shape, different
/// re-entry hint (password, not a Member ID). Shared by every staff role's
/// drawer sign-out row and "My Profile"'s own logout action.
Future<void> showStaffLogoutDialog(BuildContext context) async {
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
        "You'll need your email and password to sign back in.",
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

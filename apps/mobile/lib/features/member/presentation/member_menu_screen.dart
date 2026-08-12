import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_button.dart';

class _MenuEntry {
  const _MenuEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
}

const _entries = [
  _MenuEntry(
    icon: Icons.calendar_month_outlined,
    title: 'My Attendance',
    subtitle: 'Visit history',
    route: AppRoutes.memberAttendance,
  ),
  _MenuEntry(
    icon: Icons.receipt_long_outlined,
    title: 'Invoices',
    subtitle: 'Payment history',
    route: AppRoutes.memberInvoices,
  ),
  _MenuEntry(
    icon: Icons.person_outline_rounded,
    title: 'Profile',
    subtitle: 'Your details',
    route: AppRoutes.memberProfile,
  ),
  _MenuEntry(
    icon: Icons.download_outlined,
    title: 'Download my data',
    subtitle: 'GDPR export',
    route: AppRoutes.memberDataExport,
  ),
];

/// Design frame "8. Menu".
class MemberMenuScreen extends StatelessWidget {
  const MemberMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final name =
        session is SessionAuthenticatedMember ? session.member.name : '';
    final initials =
        session is SessionAuthenticatedMember ? session.member.initials : '';

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Menu', style: AppText.eyebrow()),
                  Text(name, style: AppText.display(size: 22)),
                ],
              ),
            ),
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                gradient: AppColors.memberGrad,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                initials,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w800,
                  color: AppColors.memberOnGrad,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        ..._entries.map((entry) => _MenuTile(entry: entry)),
        const SizedBox(height: 8),
        AppButton(
          label: 'Log out',
          role: AppRole.member,
          variant: AppButtonVariant.ghost,
          foregroundColor: AppColors.danger,
          onPressed: () => showMemberLogoutDialog(context),
        ),
      ],
    );
  }
}

/// Design frame "8g. Log out" — a confirm step, since signing back in
/// needs the Member ID.
Future<void> showMemberLogoutDialog(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: AppColors.surface2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      title: Text('Log out of FitCloud?', style: AppText.display(size: 18)),
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

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.entry});

  final _MenuEntry entry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context.push(entry.route),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.memberSoft,
                    borderRadius: BorderRadius.circular(AppRadii.tile),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    entry.icon,
                    size: 18,
                    color: AppColors.memberPillFg,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.title,
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      Text(
                        entry.subtitle,
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.inkFaint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

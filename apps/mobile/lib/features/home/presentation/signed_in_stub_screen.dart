import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/brand_mark.dart';

/// Temporary landing spot once Chunk 1's auth pipeline completes — proves
/// the whole flow works end-to-end. Replaced by the real per-role
/// dashboard shells in Chunks 2-5 (Tenant/Manager/Trainer/Receptionist,
/// then Member).
class SignedInStubScreen extends StatelessWidget {
  const SignedInStubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final AppRole role =
        session is SessionAuthenticatedMember ? AppRole.member : AppRole.staff;
    final String name = switch (session) {
      SessionAuthenticatedStaff(:final user) => user.name,
      SessionAuthenticatedMember(:final member) => member.name,
      _ => '',
    };
    final String subtitle = switch (session) {
      SessionAuthenticatedStaff(:final user) => user.roles.join(' · '),
      SessionAuthenticatedMember(:final member) => member.memberId,
      _ => '',
    };

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                BrandMark.glyph(role: role, size: 72),
                const SizedBox(height: 20),
                Text('Signed in', style: AppText.display(size: 24)),
                const SizedBox(height: 8),
                Text(
                  name,
                  style: AppText.body(size: 16, weight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                AppPill(
                  label: subtitle,
                  tone: AppPillTone.roleTint,
                  role: role,
                ),
                const SizedBox(height: 28),
                AppButton(
                  label: 'Sign out',
                  role: role,
                  variant: AppButtonVariant.ghost,
                  fullWidth: false,
                  onPressed: () => context.read<SessionCubit>().signOut(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

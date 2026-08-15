import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_portal_profile.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'member_menu_screen.dart';

/// Design frame "8e. Profile" — read-only. `/portal/*` has no profile
/// update route (the member plane is read-mostly: progress logging and
/// class booking are its only writes), so nothing here is editable.
class MemberProfileScreen extends StatefulWidget {
  const MemberProfileScreen({super.key});

  @override
  State<MemberProfileScreen> createState() => _MemberProfileScreenState();
}

class _MemberProfileScreenState extends State<MemberProfileScreen> {
  MemberPortalProfile? _profile;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await getIt<MemberPortalRepository>().me();
      if (!mounted) return;
      setState(() => _profile = profile);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Profile', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView(role: AppRole.member)
            : _error != null
                ? AppErrorView(
                    message: _error!,
                    onRetry: _load,
                    role: AppRole.member,
                  )
                : profile == null
                    ? const SizedBox.shrink()
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        children: [
                          Container(
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0x24C6F135), Color(0x1A14E0B4)],
                              ),
                              borderRadius:
                                  BorderRadius.circular(AppRadii.card),
                              border: Border.all(color: AppColors.glassBorder),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: const BoxDecoration(
                                    gradient: AppColors.memberGrad,
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    profile.initials,
                                    style: AppText.body(
                                      size: 15,
                                      weight: FontWeight.w800,
                                      color: AppColors.memberOnGrad,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        profile.name,
                                        style: AppText.body(
                                          size: 15,
                                          weight: FontWeight.w800,
                                        ),
                                      ),
                                      Text(
                                        '${profile.memberId} · ${profile.branch.name}',
                                        style: AppText.body(
                                          size: 12,
                                          color: AppColors.inkFaint,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surface2,
                              borderRadius:
                                  BorderRadius.circular(AppRadii.card),
                              border: Border.all(color: AppColors.line),
                            ),
                            child: Column(
                              children: [
                                _Row(label: 'Status', value: profile.status),
                                if (profile.email != null)
                                  _Row(label: 'Email', value: profile.email!),
                                if (profile.phone != null)
                                  _Row(label: 'Phone', value: profile.phone!),
                                if (profile.currentMembership != null)
                                  _Row(
                                    label: 'Plan',
                                    value: profile.currentMembership!.planName,
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surface2,
                              borderRadius:
                                  BorderRadius.circular(AppRadii.card),
                              border: Border.all(color: AppColors.line),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('My data', style: AppText.eyebrow()),
                                const SizedBox(height: 6),
                                Text(
                                  'See everything FitCloud stores about you.',
                                  style: AppText.body(
                                    size: 13,
                                    weight: FontWeight.w600,
                                    color: AppColors.inkSoft,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                AppButton(
                                  label: 'Download my data',
                                  role: AppRole.member,
                                  variant: AppButtonVariant.ghost,
                                  size: AppButtonSize.small,
                                  onPressed: () =>
                                      context.push(AppRoutes.memberDataExport),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                          AppButton(
                            label: 'Log out',
                            role: AppRole.member,
                            variant: AppButtonVariant.ghost,
                            foregroundColor: AppColors.danger,
                            onPressed: () => showMemberLogoutDialog(context),
                          ),
                        ],
                      ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

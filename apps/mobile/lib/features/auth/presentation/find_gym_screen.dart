import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/public_tenant_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/brand_mark.dart';
import '../../../shared/widgets/role_toggle.dart';
import 'login_screen.dart';

/// Design frame "2. Find your gym" (staff copy) / member section frame "2"
/// (member copy) — merged into one screen with a [RoleToggle] so the same
/// entry surface serves both flows, matching this codebase's precedent of
/// a shared resolve/login page distinguishing Staff vs Member.
class FindGymScreen extends StatefulWidget {
  const FindGymScreen({super.key});

  @override
  State<FindGymScreen> createState() => _FindGymScreenState();
}

class _FindGymScreenState extends State<FindGymScreen> {
  final _controller = TextEditingController();
  AppRole _role = AppRole.staff;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    final slug = _controller.text.trim().toLowerCase();
    if (slug.isEmpty) {
      setState(() => _error = 'Enter your gym ID to continue');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final TenantBranding tenant =
          await getIt<PublicTenantRepository>().resolve(slug);
      if (!mounted) return;
      context.push(
        AppRoutes.login,
        extra: LoginScreenArgs(role: _role, tenant: tenant),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isStaff = _role == AppRole.staff;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              RoleToggle(
                value: _role,
                onChanged: (r) => setState(() => _role = r),
              ),
              const SizedBox(height: 28),
              BrandMark.glyph(role: _role, size: 64),
              const SizedBox(height: 16),
              Text('Find your gym', style: AppText.display(size: 26)),
              const SizedBox(height: 8),
              Text(
                isStaff
                    ? 'Enter your gym\'s ID to continue as staff'
                    : 'Enter your gym\'s ID to sign in as a member',
                style: AppText.body(color: AppColors.inkSoft),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),
              AppCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    AppLabeledField(
                      label: 'Gym ID',
                      controller: _controller,
                      textCapitalization: TextCapitalization.none,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _continue(),
                      errorText: _error,
                    ),
                    const SizedBox(height: 14),
                    AppButton(
                      label: 'Continue',
                      role: _role,
                      loading: _loading,
                      onPressed: _continue,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                isStaff
                    ? 'Or scan the QR code on your welcome email'
                    : 'Or scan the QR code your gym gave you',
                style: AppText.body(
                  size: 12,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

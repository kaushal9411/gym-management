import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/member_auth_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

class ForgotPasswordScreenArgs {
  const ForgotPasswordScreenArgs({
    required this.role,
    required this.tenant,
    this.prefill,
  });

  final AppRole role;
  final TenantBranding tenant;
  final String? prefill;
}

/// Not a literal design frame (the login screens only link out to this),
/// built with the same component vocabulary. Staff hits
/// `POST /auth/forgot-password` (email), member hits
/// `POST /member/auth/forgot-password` (memberId) — always succeeds
/// without revealing whether the account exists, so the UI shows one
/// generic confirmation regardless of the response.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.args});

  final ForgotPasswordScreenArgs args;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final _controller =
      TextEditingController(text: widget.args.prefill ?? '');
  bool _loading = false;
  bool _sent = false;
  String? _error;

  bool get _isStaff => widget.args.role == AppRole.staff;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final value = _controller.text.trim();
    if (value.isEmpty) {
      setState(
        () => _error =
            _isStaff ? 'Enter your work email' : 'Enter your Member ID',
      );
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_isStaff) {
        await getIt<AuthRepository>().forgotPassword(email: value);
      } else {
        await getIt<MemberAuthRepository>().forgotPassword(memberId: value);
      }
      if (!mounted) return;
      setState(() => _sent = true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.args.role;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Reset password'),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: _sent
              ? _SentConfirmation(role: role, isStaff: _isStaff)
              : _buildForm(role),
        ),
      ),
    );
  }

  Widget _buildForm(AppRole role) {
    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: 12),
          Text(
            _isStaff
                ? 'We\'ll email you a link to reset your password.'
                : 'We\'ll send a reset link for your portal account.',
            style: AppText.body(color: AppColors.inkSoft),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 22),
          AppCard(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                if (_error != null) ...[
                  FormAlert(message: _error!),
                  const SizedBox(height: 14),
                ],
                AppLabeledField(
                  label: _isStaff ? 'Work email' : 'Member ID',
                  controller: _controller,
                  keyboardType: _isStaff
                      ? TextInputType.emailAddress
                      : TextInputType.text,
                  textCapitalization: _isStaff
                      ? TextCapitalization.none
                      : TextCapitalization.characters,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 16),
                AppButton(
                  label: 'Send reset link',
                  role: role,
                  loading: _loading,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SentConfirmation extends StatelessWidget {
  const _SentConfirmation({required this.role, required this.isStaff});

  final AppRole role;
  final bool isStaff;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(
              color: AppColors.successSoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.mark_email_read_outlined,
              color: AppColors.success,
              size: 28,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Check your email',
            style: AppText.display(size: 20),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            isStaff
                ? 'If an account exists for that email, a reset link is on its way.'
                : 'If a portal account exists for that Member ID, a reset link has been sent.',
            style: AppText.body(color: AppColors.inkFaint),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

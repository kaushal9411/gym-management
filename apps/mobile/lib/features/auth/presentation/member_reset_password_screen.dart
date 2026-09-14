import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/member_auth_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Consumes a member portal password-reset link. Counterpart to
/// [ForgotPasswordScreen]'s member branch — that screen only sends the
/// email; this is where the emailed token is actually used.
///
/// No deep-link handling exists anywhere in this app (no `app_links`/
/// `uni_links`, no platform manifest wiring — confirmed, this app has never
/// needed to receive a link from outside itself before). So a member who
/// taps the emailed `https://.../portal/reset-password?token=...` link
/// today opens it in a browser, not this screen. Reached instead from
/// [ForgotPasswordScreen]'s confirmation view via a "Have a reset code?"
/// link, where the user pastes the code (or the whole link — the token is
/// extracted from a `?token=` query param if a full URL is pasted) by hand.
class MemberResetPasswordScreen extends StatefulWidget {
  const MemberResetPasswordScreen({super.key});

  @override
  State<MemberResetPasswordScreen> createState() =>
      _MemberResetPasswordScreenState();
}

class _MemberResetPasswordScreenState
    extends State<MemberResetPasswordScreen> {
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _loading = false;
  bool _done = false;
  String? _tokenError;
  String? _passwordError;
  String? _confirmError;
  String? _error;

  @override
  void dispose() {
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  /// A member is likely to paste the whole emailed link rather than just
  /// the code at the end of it — pull the `token` query param out if one
  /// is present, otherwise treat the whole input as the raw token.
  String _extractToken(String raw) {
    final trimmed = raw.trim();
    final uri = Uri.tryParse(trimmed);
    final fromQuery = uri?.queryParameters['token'];
    if (fromQuery != null && fromQuery.isNotEmpty) return fromQuery;
    return trimmed;
  }

  Future<void> _submit() async {
    final token = _extractToken(_tokenController.text);
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    setState(() {
      _tokenError = token.isEmpty ? 'Paste your reset code or link' : null;
      _passwordError =
          password.length < 8 ? 'At least 8 characters' : null;
      _confirmError = confirm != password ? 'Passwords don\'t match' : null;
      _error = null;
    });
    if (_tokenError != null || _passwordError != null || _confirmError != null) {
      return;
    }

    setState(() => _loading = true);
    try {
      await getIt<MemberAuthRepository>().resetPassword(
        token: token,
        password: password,
      );
      if (!mounted) return;
      setState(() => _done = true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
          child: _done ? const _ResetDoneConfirmation() : _buildForm(),
        ),
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: 12),
          Text(
            'Paste the reset code from your email, then choose a new '
            'password.',
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
                  label: 'Reset code',
                  hintText: 'Paste the code or link from your email',
                  controller: _tokenController,
                  errorText: _tokenError,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 14),
                AppLabeledField(
                  label: 'New password',
                  hintText: 'At least 8 characters',
                  controller: _passwordController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  errorText: _passwordError,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 14),
                AppLabeledField(
                  label: 'Confirm new password',
                  hintText: 'Re-enter your new password',
                  controller: _confirmController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  errorText: _confirmError,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 16),
                AppButton(
                  label: 'Reset password',
                  role: AppRole.member,
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

class _ResetDoneConfirmation extends StatelessWidget {
  const _ResetDoneConfirmation();

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
              Icons.check_circle_outline,
              color: AppColors.success,
              size: 28,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Password reset',
            style: AppText.display(size: 20),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Your password has been changed — sign in with it now.',
            style: AppText.body(color: AppColors.inkFaint),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

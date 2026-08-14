import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/auth_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// "My Profile" → "Change password". `PATCH /auth/change-password` revokes
/// every other active session on success — this device stays signed in.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final current = _currentController.text;
    final next = _newController.text;
    final confirm = _confirmController.text;
    if (current.isEmpty || next.isEmpty) {
      setState(() => _error = 'Both password fields are required');
      return;
    }
    if (next != confirm) {
      setState(() => _error = 'New passwords don\'t match');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<AuthRepository>().changePassword(
        currentPassword: current,
        newPassword: next,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password changed. Other devices were signed out.'),
        ),
      );
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Change password', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            if (_error != null) ...[
              FormAlert(message: _error!),
              const SizedBox(height: 12),
            ],
            AppLabeledField(
              label: 'Current password',
              hintText: 'Enter your current password',
              controller: _currentController,
              obscureText: true,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'New password',
              hintText: 'At least 8 characters',
              controller: _newController,
              obscureText: true,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Confirm new password',
              hintText: 'Re-enter new password',
              controller: _confirmController,
              obscureText: true,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: 20),
            AppButton(
              label: 'Change password',
              loading: _saving,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'profile_ui.dart';

/// My Profile → Change password — web's Password tab. `PATCH
/// /auth/change-password` revokes every other session on success (this device
/// stays signed in). Same rules as web's form: all three fields, the new one
/// must pass the server's policy (live checklist) and match the confirmation.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  String _name = 'My profile';
  String _email = '';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadHeader();
  }

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _loadHeader() async {
    try {
      final p = await getIt<ProfileRepository>().getProfile();
      if (mounted) {
        setState(() {
          _name = p.name;
          _email = p.email;
        });
      }
    } catch (_) {
      // Cosmetic only — the form works without it.
    }
  }

  Future<void> _submit() async {
    final current = _current.text;
    final next = _new.text;
    if (current.isEmpty || next.isEmpty) {
      setState(() => _error = 'Both password fields are required.');
      return;
    }
    if (!PasswordRules.isValid(next)) {
      setState(() => _error = 'The new password does not meet every rule.');
      return;
    }
    if (next != _confirm.text) {
      setState(() => _error = "New passwords don't match.");
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
      teamSnack(context, 'Password changed. Other devices were signed out.');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not change it ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ProfileFormPage(
      title: 'Change password',
      chip: 'Security · Password',
      icon: Icons.key_rounded,
      color: TeamColors.indigo,
      name: _name,
      subtitle: _email,
      error: _error,
      saving: _saving,
      onSave: _submit,
      saveLabel: 'Change password',
      saveIcon: Icons.lock_reset_rounded,
      sections: [
        TeamFormSection(
          icon: Icons.key_rounded,
          color: TeamColors.indigo,
          title: 'Change password',
          subtitle: 'Changing it signs you out of every other session.',
          children: [
            AppLabeledField(
              label: 'Current password',
              hintText: 'Enter your current password',
              icon: Icons.lock_outline_rounded,
              iconColor: TeamColors.indigo,
              controller: _current,
              obscureText: true,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'New password',
              hintText: 'Choose a strong password',
              icon: Icons.password_rounded,
              iconColor: TeamColors.violet,
              controller: _new,
              obscureText: true,
              textInputAction: TextInputAction.next,
              onChanged: (_) => setState(() {}),
            ),
            PasswordRules(password: _new.text),
            AppLabeledField(
              label: 'Confirm new password',
              hintText: 'Re-enter the new password',
              icon: Icons.verified_outlined,
              iconColor: TeamColors.green,
              controller: _confirm,
              obscureText: true,
              textInputAction: TextInputAction.done,
            ),
          ],
        ),
        TeamSectionCard(
          icon: Icons.tips_and_updates_outlined,
          color: TeamColors.green,
          title: 'Good habits',
          child: const Padding(
            padding: EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ProfileNote('Use a password you do not use anywhere else.'),
                ProfileNote('A long phrase beats a short complex one.'),
                ProfileNote(
                  'Pair it with two-factor authentication (Two-factor page).',
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/iam_user.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// `PATCH /users/:id` — account details (name, email, phone) and the
/// emergency contact, i.e. web's "Account details" card plus the contact
/// fields the endpoint also accepts. Only changed fields are sent; a phone
/// number can be replaced but not removed (the schema isn't nullable).
class UserEditProfileScreen extends StatefulWidget {
  const UserEditProfileScreen({required this.user, super.key});

  final IamUser user;

  @override
  State<UserEditProfileScreen> createState() => _UserEditProfileScreenState();
}

class _UserEditProfileScreenState extends State<UserEditProfileScreen> {
  IamUser get u => widget.user;

  late final _name = TextEditingController(text: u.name);
  late final _email = TextEditingController(text: u.email);
  late final _phone = TextEditingController(text: u.phone ?? '');
  late final _emName =
      TextEditingController(text: u.emergencyContactName ?? '');
  late final _emPhone =
      TextEditingController(text: u.emergencyContactPhone ?? '');
  late final _emRelation =
      TextEditingController(text: u.emergencyContactRelation ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _email, _phone, _emName, _emPhone, _emRelation]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Name must be at least 2 characters');
      return;
    }
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    final phone = _phone.text.trim();
    if (phone.isEmpty && (u.phone ?? '').isNotEmpty) {
      setState(
        () => _error = "A phone number can't be removed once set — "
            'replace it instead',
      );
      return;
    }
    final changes = <String, dynamic>{};
    if (name != u.name) changes['name'] = name;
    if (email != u.email) changes['email'] = email;
    if (phone != (u.phone ?? '')) changes['phone'] = phone;
    void opt(String key, TextEditingController c, String? old) {
      final v = c.text.trim();
      if (v != (old ?? '')) changes[key] = v.isEmpty ? null : v;
    }

    opt('emergencyContactName', _emName, u.emergencyContactName);
    opt('emergencyContactPhone', _emPhone, u.emergencyContactPhone);
    opt('emergencyContactRelation', _emRelation, u.emergencyContactRelation);

    if (changes.isEmpty) {
      context.pop();
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<IamUserRepository>().update(u.id, changes);
      if (!mounted) return;
      teamSnack(context, 'Profile saved.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return TeamEditScaffold(
      name: u.name,
      subtitle: u.email,
      avatarUrl: u.avatarUrl,
      title: 'Account details',
      icon: Icons.manage_accounts_rounded,
      color: TeamColors.indigo,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        TeamFormSection(
          icon: Icons.person_rounded,
          color: TeamColors.indigo,
          title: 'Account',
          children: [
            AppLabeledField(
              label: 'Name',
              controller: _name,
              icon: Icons.person_rounded,
              iconColor: TeamColors.indigo,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Email',
              controller: _email,
              icon: Icons.mail_rounded,
              iconColor: TeamColors.sky,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Phone',
              controller: _phone,
              icon: Icons.call_rounded,
              iconColor: TeamColors.green,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.emergency_rounded,
          color: TeamColors.rose,
          title: 'Emergency contact',
          children: [
            AppLabeledField(
              label: 'Name',
              controller: _emName,
              icon: Icons.person_outline_rounded,
              iconColor: TeamColors.rose,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Phone',
              controller: _emPhone,
              icon: Icons.call_rounded,
              iconColor: TeamColors.rose,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Relation',
              controller: _emRelation,
              icon: Icons.family_restroom_rounded,
              iconColor: TeamColors.rose,
              hintText: 'e.g. Spouse',
              textCapitalization: TextCapitalization.words,
            ),
          ],
        ),
      ],
    );
  }
}

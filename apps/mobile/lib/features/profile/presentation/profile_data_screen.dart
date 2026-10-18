import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/staff_profile.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'profile_ui.dart';

/// My Profile → Personal details — web's "Personal details" panel (full name
/// and phone; the photo is changed from the hub header). Owns only `name` /
/// `phone`: the PATCH never carries the avatar, emergency contact or
/// preferences (an absent key leaves them alone, `null` would clear them —
/// see `ProfileRepository`). Name needs 2+ characters, like web's Save button.
class ProfileDataScreen extends StatefulWidget {
  const ProfileDataScreen({super.key});

  @override
  State<ProfileDataScreen> createState() => _ProfileDataScreenState();
}

class _ProfileDataScreenState extends State<ProfileDataScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  StaffProfile? _profile;
  String? _loadError;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final p = await getIt<ProfileRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _profile = p;
        _name.text = p.name;
        _phone.text = p.phone ?? '';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = 'Could not load ($e)');
    }
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Full name is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final phone = _phone.text.trim();
      await getIt<ProfileRepository>().updateBasicInfo(
        name: name,
        phone: phone.isEmpty ? null : phone,
      );
      if (!mounted) return;
      await context.read<SessionCubit>().refreshStaffUser();
      if (!mounted) return;
      teamSnack(context, 'Profile saved');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not save ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    return ProfileFormPage(
      title: 'Personal details',
      chip: 'Account · Personal details',
      icon: Icons.badge_outlined,
      color: kProfileColor,
      name: p?.name ?? 'My profile',
      subtitle: p?.email ?? '',
      avatarUrl: p?.avatarUrl,
      loading: p == null && _loadError == null,
      loadError: p == null ? _loadError : null,
      onRetry: _load,
      error: _error,
      saving: _saving,
      onSave: _save,
      sections: [
        TeamFormSection(
          icon: Icons.person_outline_rounded,
          color: kProfileColor,
          title: 'Your name and phone',
          subtitle: 'Change your photo from the profile header.',
          children: [
            AppLabeledField(
              label: 'Full name',
              hintText: 'e.g. Priya Sharma',
              icon: Icons.person_outline_rounded,
              iconColor: kProfileColor,
              controller: _name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Phone',
              hintText: 'e.g. 9876543210',
              icon: Icons.phone_outlined,
              iconColor: TeamColors.teal,
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
            ),
          ],
        ),
      ],
    );
  }
}

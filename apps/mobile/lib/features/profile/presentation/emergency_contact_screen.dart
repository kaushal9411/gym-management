import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/staff_profile.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'profile_ui.dart';

/// My Profile → Emergency contact — web's "Emergency contact" panel (name,
/// phone, relation). Owns only the three `emergencyContact*` fields; empty
/// ones are cleared (`null`), exactly like web.
class EmergencyContactScreen extends StatefulWidget {
  const EmergencyContactScreen({super.key});

  @override
  State<EmergencyContactScreen> createState() => _EmergencyContactScreenState();
}

class _EmergencyContactScreenState extends State<EmergencyContactScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _relation = TextEditingController();
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
    _relation.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final p = await getIt<ProfileRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _profile = p;
        _name.text = p.emergencyContact.name ?? '';
        _phone.text = p.emergencyContact.phone ?? '';
        _relation.text = p.emergencyContact.relation ?? '';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = 'Could not load ($e)');
    }
  }

  String? _v(TextEditingController c) {
    final t = c.text.trim();
    return t.isEmpty ? null : t;
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<ProfileRepository>().updateEmergencyContact(
        name: _v(_name),
        phone: _v(_phone),
        relation: _v(_relation),
      );
      if (!mounted) return;
      teamSnack(context, 'Emergency contact saved');
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
      title: 'Emergency contact',
      chip: 'Account · Emergency contact',
      icon: Icons.emergency_outlined,
      color: TeamColors.amber,
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
          icon: Icons.favorite_outline_rounded,
          color: TeamColors.amber,
          title: 'Who we should call if needed',
          children: [
            AppLabeledField(
              label: 'Name',
              hintText: 'e.g. Priya Sharma',
              icon: Icons.person_outline_rounded,
              iconColor: TeamColors.amber,
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
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Relation',
              hintText: 'e.g. Spouse, Parent, Sibling',
              icon: Icons.family_restroom_rounded,
              iconColor: TeamColors.rose,
              controller: _relation,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.done,
            ),
          ],
        ),
      ],
    );
  }
}

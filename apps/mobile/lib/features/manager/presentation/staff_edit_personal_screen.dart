import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../team/presentation/widgets/team_ui.dart';

const staffGenderOptions = [
  ('MALE', 'Male'),
  ('FEMALE', 'Female'),
  ('OTHER', 'Other'),
  ('PREFER_NOT_TO_SAY', 'Prefer not to say'),
];

/// Edit a staff member's personal details (`PATCH /staff/:id`) — identity,
/// address, emergency contact and notes, i.e. everything web's "Personal
/// details" / "Address & emergency contact" / "Notes" cards edit. Only the
/// fields that actually changed are sent; cleared optional fields go as
/// `null`. The profile photo is changed from the profile hero.
class StaffEditPersonalScreen extends StatefulWidget {
  const StaffEditPersonalScreen({super.key, required this.staff});

  final StaffMember staff;

  @override
  State<StaffEditPersonalScreen> createState() =>
      _StaffEditPersonalScreenState();
}

class _StaffEditPersonalScreenState extends State<StaffEditPersonalScreen> {
  StaffMember get s => widget.staff;

  late final _first = TextEditingController(text: s.firstName);
  late final _last = TextEditingController(text: s.lastName);
  late final _email = TextEditingController(text: s.email);
  late final _phone = TextEditingController(text: s.phone ?? '');
  late final _employeeId = TextEditingController(text: s.employeeId);
  late final _address = TextEditingController(text: s.addressLine ?? '');
  late final _city = TextEditingController(text: s.city ?? '');
  late final _state = TextEditingController(text: s.state ?? '');
  late final _country = TextEditingController(text: s.country ?? '');
  late final _postal = TextEditingController(text: s.postalCode ?? '');
  late final _emName =
      TextEditingController(text: s.emergencyContactName ?? '');
  late final _emPhone =
      TextEditingController(text: s.emergencyContactPhone ?? '');
  late final _emRelation =
      TextEditingController(text: s.emergencyContactRelation ?? '');
  late final _notes = TextEditingController(text: s.notes ?? '');
  late String? _gender = s.gender;
  late DateTime? _dob = parseIsoDate(s.dateOfBirth);
  late DateTime _joined = s.joiningDate;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _first,
      _last,
      _email,
      _phone,
      _employeeId,
      _address,
      _city,
      _state,
      _country,
      _postal,
      _emName,
      _emPhone,
      _emRelation,
      _notes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final changes = <String, dynamic>{};
    void req(String key, TextEditingController c, String old) {
      final v = c.text.trim();
      if (v != old) changes[key] = v;
    }

    void opt(String key, TextEditingController c, String? old) {
      final v = c.text.trim();
      if (v != (old ?? '')) changes[key] = v.isEmpty ? null : v;
    }

    final first = _first.text.trim();
    final last = _last.text.trim();
    final email = _email.text.trim();
    if (first.isEmpty || last.isEmpty) {
      setState(() => _error = 'First and last name are required');
      return;
    }
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    if (_employeeId.text.trim().isEmpty) {
      setState(() => _error = 'Employee ID cannot be empty');
      return;
    }
    if (_phone.text.trim().isEmpty && (s.phone ?? '').isNotEmpty) {
      setState(
        () => _error = "A phone number can't be removed once set — "
            'replace it instead',
      );
      return;
    }
    req('firstName', _first, s.firstName);
    req('lastName', _last, s.lastName);
    req('email', _email, s.email);
    if (_phone.text.trim() != (s.phone ?? '')) {
      changes['phone'] = _phone.text.trim();
    }
    req('employeeId', _employeeId, s.employeeId);
    if (_gender != s.gender) changes['gender'] = _gender;
    final oldDob = parseIsoDate(s.dateOfBirth);
    if (_dob != oldDob) {
      changes['dateOfBirth'] = _dob == null ? null : isoDate(_dob!);
    }
    if (isoDate(_joined) != isoDate(s.joiningDate)) {
      changes['joiningDate'] = isoDate(_joined);
    }
    opt('addressLine', _address, s.addressLine);
    opt('city', _city, s.city);
    opt('state', _state, s.state);
    opt('country', _country, s.country);
    opt('postalCode', _postal, s.postalCode);
    opt('emergencyContactName', _emName, s.emergencyContactName);
    opt('emergencyContactPhone', _emPhone, s.emergencyContactPhone);
    opt('emergencyContactRelation', _emRelation, s.emergencyContactRelation);
    opt('notes', _notes, s.notes);

    if (changes.isEmpty) {
      context.pop();
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<StaffRepository>().update(s.id, changes);
      if (!mounted) return;
      teamSnack(context, 'Personal details saved.');
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
      name: s.name,
      subtitle: s.employeeId,
      avatarUrl: s.avatarUrl,
      title: 'Personal info',
      icon: Icons.person_rounded,
      color: TeamColors.indigo,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        TeamFormSection(
          icon: Icons.badge_rounded,
          color: TeamColors.indigo,
          title: 'Identity',
          children: [
            AppLabeledField(
              label: 'First name',
              controller: _first,
              icon: Icons.person_rounded,
              iconColor: TeamColors.indigo,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Last name',
              controller: _last,
              icon: Icons.person_outline_rounded,
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
            AppLabeledField(
              label: 'Employee ID',
              controller: _employeeId,
              icon: Icons.numbers_rounded,
              iconColor: TeamColors.violet,
              hintText: 'Letters, numbers and hyphens',
              textInputAction: TextInputAction.next,
            ),
            OptionPickerField(
              label: 'Gender',
              options: staffGenderOptions,
              value: _gender,
              icon: Icons.wc_rounded,
              iconColor: TeamColors.fuchsia,
              onChanged: (v) => setState(() => _gender = v),
            ),
            TeamDateField(
              label: 'Date of birth',
              icon: Icons.cake_rounded,
              iconColor: TeamColors.rose,
              value: _dob,
              lastDate: DateTime.now(),
              onChanged: (d) => setState(() => _dob = d),
            ),
            TeamDateField(
              label: 'Joining date',
              icon: Icons.event_rounded,
              iconColor: TeamColors.amber,
              value: _joined,
              clearable: false,
              onChanged: (d) {
                if (d != null) setState(() => _joined = d);
              },
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.home_rounded,
          color: TeamColors.teal,
          title: 'Address',
          children: [
            AppLabeledField(
              label: 'Address',
              controller: _address,
              icon: Icons.place_rounded,
              iconColor: TeamColors.teal,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'City',
              controller: _city,
              icon: Icons.location_city_rounded,
              iconColor: TeamColors.teal,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'State',
              controller: _state,
              icon: Icons.map_rounded,
              iconColor: TeamColors.teal,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Country',
              controller: _country,
              icon: Icons.public_rounded,
              iconColor: TeamColors.teal,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Postal code',
              controller: _postal,
              icon: Icons.markunread_mailbox_rounded,
              iconColor: TeamColors.teal,
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
              textInputAction: TextInputAction.next,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.sticky_note_2_rounded,
          color: TeamColors.amber,
          title: 'Notes',
          children: [
            AppLabeledField(
              label: 'Notes',
              controller: _notes,
              icon: Icons.notes_rounded,
              iconColor: TeamColors.amber,
              minLines: 3,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
            ),
          ],
        ),
      ],
    );
  }
}

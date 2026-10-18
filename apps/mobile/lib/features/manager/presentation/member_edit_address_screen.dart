import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/member_edit_scaffold.dart';

/// Design frame "7e. Edit address" — address + emergency contact, both
/// plain `PATCH /members/:id` fields.
class MemberEditAddressScreen extends StatefulWidget {
  const MemberEditAddressScreen({super.key, required this.member});

  final GymMember member;

  @override
  State<MemberEditAddressScreen> createState() =>
      _MemberEditAddressScreenState();
}

class _MemberEditAddressScreenState extends State<MemberEditAddressScreen> {
  late final _addressController =
      TextEditingController(text: widget.member.addressLine ?? '');
  late final _cityController =
      TextEditingController(text: widget.member.city ?? '');
  late final _stateController =
      TextEditingController(text: widget.member.state ?? '');
  late final _countryController =
      TextEditingController(text: widget.member.country ?? '');
  late final _postalCodeController =
      TextEditingController(text: widget.member.postalCode ?? '');
  late final _emergencyNameController =
      TextEditingController(text: widget.member.emergencyContactName ?? '');
  late final _emergencyPhoneController =
      TextEditingController(text: widget.member.emergencyContactPhone ?? '');
  late final _emergencyRelationController = TextEditingController(
    text: widget.member.emergencyContactRelation ?? '',
  );
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _addressController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _countryController.dispose();
    _postalCodeController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _emergencyRelationController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>().update(widget.member.id, {
        'addressLine': _orNull(_addressController.text),
        'city': _orNull(_cityController.text),
        'state': _orNull(_stateController.text),
        'country': _orNull(_countryController.text),
        'postalCode': _orNull(_postalCodeController.text),
        'emergencyContactName': _orNull(_emergencyNameController.text),
        'emergencyContactPhone': _orNull(_emergencyPhoneController.text),
        'emergencyContactRelation': _orNull(_emergencyRelationController.text),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Address and emergency contact updated successfully'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _orNull(String v) => v.trim().isEmpty ? null : v.trim();

  @override
  Widget build(BuildContext context) {
    const amber = Color(0xFFF59E0B);
    const rose = Color(0xFFFF5C7A);
    return MemberEditScaffold(
      member: widget.member,
      title: 'Address & Emergency',
      icon: Icons.location_on_rounded,
      color: amber,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        FormSection(
          icon: Icons.home_rounded,
          color: amber,
          title: 'Address',
          subtitle: 'Where this member lives',
          children: [
            AppLabeledField(
              label: 'Address line',
              hintText: 'Street, building, area',
              icon: Icons.home_rounded,
              iconColor: amber,
              controller: _addressController,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: AppLabeledField(
                    label: 'City',
                    hintText: 'e.g. Mumbai',
                    icon: Icons.location_city_rounded,
                    iconColor: amber,
                    controller: _cityController,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppLabeledField(
                    label: 'State',
                    hintText: 'e.g. Maharashtra',
                    icon: Icons.map_rounded,
                    iconColor: amber,
                    controller: _stateController,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: AppLabeledField(
                    label: 'Country',
                    hintText: 'e.g. India',
                    icon: Icons.public_rounded,
                    iconColor: amber,
                    controller: _countryController,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppLabeledField(
                    label: 'Postal code',
                    hintText: 'e.g. 400001',
                    icon: Icons.markunread_mailbox_rounded,
                    iconColor: amber,
                    controller: _postalCodeController,
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
          ],
        ),
        FormSection(
          icon: Icons.phone_in_talk_rounded,
          color: rose,
          title: 'Emergency contact',
          subtitle: 'Who to call if needed',
          children: [
            AppLabeledField(
              label: 'Name',
              hintText: 'e.g. Priya Sharma',
              icon: Icons.person_rounded,
              iconColor: rose,
              controller: _emergencyNameController,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: AppLabeledField(
                    label: 'Phone',
                    hintText: 'e.g. 9876543210',
                    icon: Icons.call_rounded,
                    iconColor: rose,
                    controller: _emergencyPhoneController,
                    keyboardType: TextInputType.phone,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppLabeledField(
                    label: 'Relation',
                    hintText: 'e.g. Spouse',
                    icon: Icons.diversity_1_rounded,
                    iconColor: rose,
                    controller: _emergencyRelationController,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

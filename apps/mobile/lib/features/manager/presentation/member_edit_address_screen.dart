import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

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
        'emergencyContactRelation':
            _orNull(_emergencyRelationController.text),
      });
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _orNull(String v) => v.trim().isEmpty ? null : v.trim();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Address · ${widget.member.name}'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                const SizedBox(height: 8),
                FormAlert(message: _error!),
              ],
              const SizedBox(height: 16),
              Text('Address', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              AppLabeledField(
                label: 'Address line',
                controller: _addressController,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'City',
                      controller: _cityController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'State',
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
                      controller: _countryController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Postal code',
                      controller: _postalCodeController,
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Text('Emergency contact', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              AppLabeledField(
                label: 'Name',
                controller: _emergencyNameController,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Phone',
                      controller: _emergencyPhoneController,
                      keyboardType: TextInputType.phone,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Relation',
                      controller: _emergencyRelationController,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Save changes',
                loading: _saving,
                onPressed: _save,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

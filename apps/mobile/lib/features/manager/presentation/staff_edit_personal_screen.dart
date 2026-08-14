import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "5b-i. Personal info" — same split rationale as
/// `MemberEditPersonalScreen`: `firstName`/`lastName` stay untouched here
/// since [StaffMember.name] is already the combined display name.
class StaffEditPersonalScreen extends StatefulWidget {
  const StaffEditPersonalScreen({super.key, required this.staff});

  final StaffMember staff;

  @override
  State<StaffEditPersonalScreen> createState() =>
      _StaffEditPersonalScreenState();
}

class _StaffEditPersonalScreenState extends State<StaffEditPersonalScreen> {
  late final _genderController =
      TextEditingController(text: widget.staff.gender ?? '');
  late final _dobController =
      TextEditingController(text: widget.staff.dateOfBirth ?? '');
  late final _addressController =
      TextEditingController(text: widget.staff.addressLine ?? '');
  late final _cityController =
      TextEditingController(text: widget.staff.city ?? '');
  late final _emergencyNameController =
      TextEditingController(text: widget.staff.emergencyContactName ?? '');
  late final _emergencyPhoneController =
      TextEditingController(text: widget.staff.emergencyContactPhone ?? '');
  late final _emergencyRelationController = TextEditingController(
    text: widget.staff.emergencyContactRelation ?? '',
  );
  late final _notesController =
      TextEditingController(text: widget.staff.notes ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _genderController.dispose();
    _dobController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _emergencyRelationController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<StaffRepository>().update(widget.staff.id, {
        'gender': _orNull(_genderController.text),
        'dateOfBirth': _orNull(_dobController.text),
        'addressLine': _orNull(_addressController.text),
        'city': _orNull(_cityController.text),
        'emergencyContactName': _orNull(_emergencyNameController.text),
        'emergencyContactPhone': _orNull(_emergencyPhoneController.text),
        'emergencyContactRelation':
            _orNull(_emergencyRelationController.text),
        'notes': _orNull(_notesController.text),
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
        title: Text('Personal Info · ${widget.staff.name}'),
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
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Gender',
                      controller: _genderController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Date of birth',
                      controller: _dobController,
                      keyboardType: TextInputType.datetime,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Address line',
                controller: _addressController,
              ),
              const SizedBox(height: 14),
              AppLabeledField(label: 'City', controller: _cityController),
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
              const SizedBox(height: 14),
              AppLabeledField(label: 'Notes', controller: _notesController),
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

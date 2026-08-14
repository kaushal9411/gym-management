import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7d. Edit personal info". `firstName`/`lastName` aren't
/// collected here — `GymMember.name` is the already-combined display name
/// and splitting it back into two fields risks silently mangling names
/// with more than two parts, so this screen only touches the fields that
/// were never split in the first place.
class MemberEditPersonalScreen extends StatefulWidget {
  const MemberEditPersonalScreen({super.key, required this.member});

  final GymMember member;

  @override
  State<MemberEditPersonalScreen> createState() =>
      _MemberEditPersonalScreenState();
}

class _MemberEditPersonalScreenState extends State<MemberEditPersonalScreen> {
  late final _genderController =
      TextEditingController(text: widget.member.gender ?? '');
  late final _dobController =
      TextEditingController(text: widget.member.dateOfBirth ?? '');
  late final _bloodGroupController =
      TextEditingController(text: widget.member.bloodGroup ?? '');
  late final _occupationController =
      TextEditingController(text: widget.member.occupation ?? '');
  late final _heightController =
      TextEditingController(text: widget.member.height?.toString() ?? '');
  late final _weightController =
      TextEditingController(text: widget.member.weight?.toString() ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _genderController.dispose();
    _dobController.dispose();
    _bloodGroupController.dispose();
    _occupationController.dispose();
    _heightController.dispose();
    _weightController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>().update(widget.member.id, {
        'gender': _orNull(_genderController.text),
        'dateOfBirth': _orNull(_dobController.text),
        'bloodGroup': _orNull(_bloodGroupController.text),
        'occupation': _orNull(_occupationController.text),
        'height': double.tryParse(_heightController.text.trim()),
        'weight': double.tryParse(_weightController.text.trim()),
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
        title: Text('Personal Info · ${widget.member.name}'),
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
                      hintText: 'e.g. Male, Female',
                      controller: _genderController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Date of birth',
                      hintText: 'YYYY-MM-DD',
                      controller: _dobController,
                      keyboardType: TextInputType.datetime,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Blood group',
                      hintText: 'e.g. O+',
                      controller: _bloodGroupController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Occupation',
                      hintText: 'e.g. Software Engineer',
                      controller: _occupationController,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Height (cm)',
                      hintText: 'e.g. 175',
                      controller: _heightController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,1}'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Weight (kg)',
                      hintText: 'e.g. 70',
                      controller: _weightController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,1}'),
                        ),
                      ],
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

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

/// Design frame "7f. Edit health & docs" — the health/fitness fields only.
/// Documents aren't built here: `uploadMemberDocumentSchema` needs a
/// data-URL file payload and this app has no file-picker component yet, so
/// adding a fake "Upload" button with nowhere to send the file would be
/// worse than not showing one — same reasoning `GymProfile`'s doc comment
/// already gives for skipping business hours.
class MemberEditHealthScreen extends StatefulWidget {
  const MemberEditHealthScreen({super.key, required this.member});

  final GymMember member;

  @override
  State<MemberEditHealthScreen> createState() =>
      _MemberEditHealthScreenState();
}

class _MemberEditHealthScreenState extends State<MemberEditHealthScreen> {
  late final _medicalController =
      TextEditingController(text: widget.member.medicalConditions ?? '');
  late final _allergiesController =
      TextEditingController(text: widget.member.allergies ?? '');
  late final _fitnessGoalsController =
      TextEditingController(text: widget.member.fitnessGoals ?? '');
  late final _notesController =
      TextEditingController(text: widget.member.notes ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _medicalController.dispose();
    _allergiesController.dispose();
    _fitnessGoalsController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>().update(widget.member.id, {
        'medicalConditions': _orNull(_medicalController.text),
        'allergies': _orNull(_allergiesController.text),
        'fitnessGoals': _orNull(_fitnessGoalsController.text),
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
        title: Text('Health & Notes · ${widget.member.name}'),
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
              Text('Health & fitness', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              AppLabeledField(
                label: 'Medical conditions',
                controller: _medicalController,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Allergies',
                controller: _allergiesController,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Fitness goals',
                controller: _fitnessGoalsController,
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

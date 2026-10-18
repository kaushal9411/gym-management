import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/member_edit_scaffold.dart';

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
  State<MemberEditHealthScreen> createState() => _MemberEditHealthScreenState();
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Health details updated successfully'),
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
    const rose = Color(0xFFFF5C7A);
    const amber = Color(0xFFF59E0B);
    const green = Color(0xFF10B981);
    const teal = Color(0xFF14B8A6);
    return MemberEditScaffold(
      member: widget.member,
      title: 'Health & Notes',
      icon: Icons.favorite_rounded,
      color: rose,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        FormSection(
          icon: Icons.favorite_rounded,
          color: rose,
          title: 'Health & fitness',
          subtitle: 'Medical details staff should know',
          children: [
            AppLabeledField(
              label: 'Medical conditions',
              hintText: 'e.g. Asthma, diabetes (optional)',
              icon: Icons.medical_services_rounded,
              iconColor: rose,
              controller: _medicalController,
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Allergies',
              hintText: 'e.g. Peanuts, dust (optional)',
              icon: Icons.warning_amber_rounded,
              iconColor: amber,
              controller: _allergiesController,
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Fitness goals',
              hintText: 'e.g. Weight loss, muscle gain',
              icon: Icons.emoji_events_rounded,
              iconColor: green,
              controller: _fitnessGoalsController,
            ),
          ],
        ),
        FormSection(
          icon: Icons.sticky_note_2_rounded,
          color: teal,
          title: 'Notes',
          subtitle: 'Anything else worth remembering',
          children: [
            AppLabeledField(
              label: 'Notes',
              hintText: 'Any other notes about this member',
              icon: Icons.edit_note_rounded,
              iconColor: teal,
              controller: _notesController,
              minLines: 3,
              maxLines: 6,
            ),
          ],
        ),
      ],
    );
  }
}

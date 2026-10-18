import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/member_edit_scaffold.dart';
import '../../../shared/widgets/option_picker_field.dart';

const _maritalStatuses = [
  ('SINGLE', 'Single'),
  ('MARRIED', 'Married'),
  ('DIVORCED', 'Divorced'),
  ('WIDOWED', 'Widowed'),
  ('PREFER_NOT_TO_SAY', 'Prefer not to say'),
];
const _goals = [
  ('WEIGHT_LOSS', 'Weight loss'),
  ('WEIGHT_GAIN', 'Weight gain'),
  ('MUSCLE_BUILDING', 'Muscle building'),
  ('GENERAL_FITNESS', 'General fitness'),
  ('ENDURANCE', 'Endurance'),
  ('REHABILITATION', 'Rehabilitation'),
  ('OTHER', 'Other'),
];
const _bodyTypes = [
  ('ECTOMORPH', 'Ectomorph'),
  ('MESOMORPH', 'Mesomorph'),
  ('ENDOMORPH', 'Endomorph'),
  ('AVERAGE', 'Average'),
  ('UNKNOWN', 'Unknown'),
];
const _foodPreferences = [
  ('VEGETARIAN', 'Vegetarian'),
  ('NON_VEGETARIAN', 'Non-vegetarian'),
  ('VEGAN', 'Vegan'),
  ('EGGETARIAN', 'Eggetarian'),
  ('UNKNOWN', 'Unknown'),
];
const _awarenessSources = [
  ('SOCIAL_MEDIA', 'Social media'),
  ('FRIEND_REFERRAL', 'Friend referral'),
  ('WALK_IN', 'Walk-in'),
  ('ADVERTISEMENT', 'Advertisement'),
  ('ONLINE_SEARCH', 'Online search'),
  ('OTHER', 'Other'),
];

/// Extended personal info (father/Aadhaar, marital status, anniversary, goal,
/// registration fee, body type, food preference, how they heard about us) —
/// the same plain `PATCH /members/:id` fields web's "Extended info" card
/// edits. "Referred by" stays read-only (needs a member search picker).
class MemberEditExtendedScreen extends StatefulWidget {
  const MemberEditExtendedScreen({super.key, required this.member});

  final GymMember member;

  @override
  State<MemberEditExtendedScreen> createState() =>
      _MemberEditExtendedScreenState();
}

class _MemberEditExtendedScreenState extends State<MemberEditExtendedScreen> {
  late final _fatherController =
      TextEditingController(text: widget.member.fatherNameOrAadhaar ?? '');
  late final _anniversaryController = TextEditingController(
    text: (widget.member.anniversary ?? '').length >= 10
        ? widget.member.anniversary!.substring(0, 10)
        : '',
  );
  late final _feeController =
      TextEditingController(text: widget.member.registrationFee ?? '');
  late String? _marital = widget.member.maritalStatus;
  late String? _goal = widget.member.goal;
  late String? _bodyType = widget.member.bodyType;
  late String? _food = widget.member.foodPreference;
  late String? _awareness = widget.member.awarenessSource;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _fatherController.dispose();
    _anniversaryController.dispose();
    _feeController.dispose();
    super.dispose();
  }

  Future<void> _pickAnniversary() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_anniversaryController.text) ?? now,
      firstDate: DateTime(1950),
      lastDate: DateTime(now.year + 1),
      initialEntryMode: DatePickerEntryMode.calendarOnly,
    );
    if (picked == null) return;
    final mm = picked.month.toString().padLeft(2, '0');
    final dd = picked.day.toString().padLeft(2, '0');
    setState(() => _anniversaryController.text = '${picked.year}-$mm-$dd');
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>().update(widget.member.id, {
        'fatherNameOrAadhaar': _orNull(_fatherController.text),
        'maritalStatus': _marital,
        'anniversary': _orNull(_anniversaryController.text),
        'goal': _goal,
        'registrationFee': double.tryParse(_feeController.text.trim()),
        'bodyType': _bodyType,
        'foodPreference': _food,
        'awarenessSource': _awareness,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Extended info updated successfully'),
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
    const violet = Color(0xFF8B5CF6);
    const teal = Color(0xFF14B8A6);
    const amber = Color(0xFFF59E0B);
    const rose = Color(0xFFFF5C7A);
    return MemberEditScaffold(
      member: widget.member,
      title: 'Extended Info',
      icon: Icons.contact_page_rounded,
      color: violet,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        FormSection(
          icon: Icons.family_restroom_rounded,
          color: violet,
          title: 'Personal',
          subtitle: 'Family and occasions',
          children: [
            AppLabeledField(
              label: 'Father name / Aadhaar',
              hintText: 'e.g. Rajesh Sharma',
              icon: Icons.family_restroom_rounded,
              iconColor: violet,
              controller: _fatherController,
            ),
            const SizedBox(height: 14),
            OptionPickerField(
              label: 'Marital status',
              icon: Icons.favorite_rounded,
              iconColor: rose,
              options: _maritalStatuses,
              value: _marital,
              onChanged: (v) => setState(() => _marital = v),
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Anniversary',
              hintText: 'Select date',
              icon: Icons.celebration_rounded,
              iconColor: amber,
              controller: _anniversaryController,
              readOnly: true,
              onTap: _pickAnniversary,
              suffixIcon: Icon(
                Icons.calendar_month_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
        FormSection(
          icon: Icons.emoji_events_rounded,
          color: teal,
          title: 'Fitness & lifestyle',
          subtitle: 'Goal, body type and food',
          children: [
            OptionPickerField(
              label: 'Goal',
              icon: Icons.flag_rounded,
              iconColor: teal,
              options: _goals,
              value: _goal,
              onChanged: (v) => setState(() => _goal = v),
            ),
            const SizedBox(height: 14),
            OptionPickerField(
              label: 'Body type',
              icon: Icons.accessibility_new_rounded,
              iconColor: teal,
              options: _bodyTypes,
              value: _bodyType,
              onChanged: (v) => setState(() => _bodyType = v),
            ),
            const SizedBox(height: 14),
            OptionPickerField(
              label: 'Food preference',
              icon: Icons.restaurant_rounded,
              iconColor: teal,
              options: _foodPreferences,
              value: _food,
              onChanged: (v) => setState(() => _food = v),
            ),
          ],
        ),
        FormSection(
          icon: Icons.card_membership_rounded,
          color: amber,
          title: 'Membership',
          subtitle: 'Fee and how they found you',
          children: [
            AppLabeledField(
              label: 'Registration fee',
              hintText: 'e.g. 500',
              icon: Icons.payments_rounded,
              iconColor: amber,
              controller: _feeController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
            ),
            const SizedBox(height: 14),
            OptionPickerField(
              label: 'Heard about us',
              icon: Icons.campaign_rounded,
              iconColor: amber,
              options: _awarenessSources,
              value: _awareness,
              onChanged: (v) => setState(() => _awareness = v),
            ),
          ],
        ),
      ],
    );
  }
}

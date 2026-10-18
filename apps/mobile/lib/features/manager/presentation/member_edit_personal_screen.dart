import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/member_edit_scaffold.dart';

/// Design frame "7d. Edit personal info" — now also covers first/last
/// name, email, phone, and Member ID (matching web's Basic Information
/// card, Prompt 62); the API already returns `firstName`/`lastName`
/// separately, so the earlier concern about mangling combined names when
/// splitting no longer applies.
class MemberEditPersonalScreen extends StatefulWidget {
  const MemberEditPersonalScreen({super.key, required this.member});

  final GymMember member;

  @override
  State<MemberEditPersonalScreen> createState() =>
      _MemberEditPersonalScreenState();
}

class _MemberEditPersonalScreenState extends State<MemberEditPersonalScreen> {
  late final _firstNameController =
      TextEditingController(text: widget.member.firstName);
  late final _lastNameController =
      TextEditingController(text: widget.member.lastName);
  late final _emailController =
      TextEditingController(text: widget.member.email ?? '');
  late final _phoneController =
      TextEditingController(text: widget.member.phone ?? '');
  late final _memberIdController =
      TextEditingController(text: widget.member.memberId);
  late String? _genderValue = widget.member.gender;
  late String? _bloodValue = widget.member.bloodGroup;
  late final _genderController = TextEditingController(
    text: _optionLabel(_genders, widget.member.gender),
  );
  late final _dobController = TextEditingController(
    text: (widget.member.dateOfBirth ?? '').length >= 10
        ? widget.member.dateOfBirth!.substring(0, 10)
        : (widget.member.dateOfBirth ?? ''),
  );
  late final _bloodGroupController = TextEditingController(
    text: _optionLabel(_bloodGroups, widget.member.bloodGroup),
  );
  late final _occupationController =
      TextEditingController(text: widget.member.occupation ?? '');
  late final _heightController =
      TextEditingController(text: widget.member.height?.toString() ?? '');
  late final _weightController =
      TextEditingController(text: widget.member.weight?.toString() ?? '');
  bool _saving = false;
  String? _error;

  static const _genders = [
    ('MALE', 'Male'),
    ('FEMALE', 'Female'),
    ('OTHER', 'Other'),
    ('PREFER_NOT_TO_SAY', 'Prefer not to say'),
  ];
  static const _bloodGroups = [
    ('A_POSITIVE', 'A+'),
    ('A_NEGATIVE', 'A−'),
    ('B_POSITIVE', 'B+'),
    ('B_NEGATIVE', 'B−'),
    ('AB_POSITIVE', 'AB+'),
    ('AB_NEGATIVE', 'AB−'),
    ('O_POSITIVE', 'O+'),
    ('O_NEGATIVE', 'O−'),
    ('UNKNOWN', 'Unknown'),
  ];

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final current = DateTime.tryParse(_dobController.text);
    final picked = await showDatePicker(
      context: context,
      initialDate: current ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
    );
    if (picked == null) return;
    final mm = picked.month.toString().padLeft(2, '0');
    final dd = picked.day.toString().padLeft(2, '0');
    setState(() => _dobController.text = '${picked.year}-$mm-$dd');
  }

  static String _optionLabel(List<(String, String)> options, String? value) {
    for (final o in options) {
      if (o.$1 == value) return o.$2;
    }
    return '';
  }

  Future<void> _pickOption(
    String title,
    List<(String, String)> options,
    String? current,
    void Function(String?) assign,
    TextEditingController controller,
  ) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
              child: Text(title, style: AppText.display(size: 17)),
            ),
            for (final o in options)
              ListTile(
                title: Text(o.$2),
                trailing: o.$1 == current
                    ? const Icon(Icons.check_rounded, color: Color(0xFF8B5CF6))
                    : null,
                onTap: () => Navigator.of(ctx).pop(o.$1),
              ),
            if (current != null)
              ListTile(
                title: Text(
                  'Clear',
                  style: TextStyle(color: AppColors.inkFaint),
                ),
                onTap: () => Navigator.of(ctx).pop(''),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    setState(() {
      final v = picked.isEmpty ? null : picked;
      assign(v);
      controller.text = _optionLabel(options, v);
    });
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _memberIdController.dispose();
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
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    if (firstName.isEmpty || lastName.isEmpty) {
      setState(() {
        _error = 'First and last name are required';
        _saving = false;
      });
      return;
    }
    try {
      await getIt<MemberRepository>().update(widget.member.id, {
        'firstName': firstName,
        'lastName': lastName,
        'email': _orNull(_emailController.text),
        'phone': _orNull(_phoneController.text),
        // Not nullable server-side (a Member ID can be changed but never
        // cleared) — omit the key entirely rather than send null.
        ..._orOmit('memberId', _memberIdController.text),
        'gender': _genderValue,
        'dateOfBirth': _orNull(_dobController.text),
        'bloodGroup': _bloodValue,
        'occupation': _orNull(_occupationController.text),
        'height': double.tryParse(_heightController.text.trim()),
        'weight': double.tryParse(_weightController.text.trim()),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Personal info updated successfully'),
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

  Map<String, dynamic> _orOmit(String key, String v) =>
      v.trim().isEmpty ? {} : {key: v.trim()};

  @override
  Widget build(BuildContext context) {
    const indigo = Color(0xFF6366F1);
    const violet = Color(0xFF8B5CF6);
    const teal = Color(0xFF14B8A6);
    const rose = Color(0xFFFF5C7A);
    const amber = Color(0xFFF59E0B);
    final numberFormatter = FilteringTextInputFormatter.allow(
      RegExp(r'^\d*\.?\d{0,1}'),
    );
    return MemberEditScaffold(
      member: widget.member,
      title: 'Personal Info',
      icon: Icons.badge_rounded,
      color: indigo,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        FormSection(
          icon: Icons.person_rounded,
          color: indigo,
          title: 'Identity',
          subtitle: 'Name and member ID',
          children: [
            Row(
              children: [
                Expanded(
                  child: AppLabeledField(
                    label: 'First name',
                    icon: Icons.person_outline_rounded,
                    iconColor: indigo,
                    controller: _firstNameController,
                    textInputAction: TextInputAction.next,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppLabeledField(
                    label: 'Last name',
                    icon: Icons.person_outline_rounded,
                    iconColor: indigo,
                    controller: _lastNameController,
                    textInputAction: TextInputAction.next,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Member ID',
              icon: Icons.badge_rounded,
              iconColor: indigo,
              controller: _memberIdController,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.next,
            ),
          ],
        ),
        FormSection(
          icon: Icons.contact_phone_rounded,
          color: teal,
          title: 'Contact',
          subtitle: 'How to reach this member',
          children: [
            AppLabeledField(
              label: 'Email',
              hintText: 'member@example.com',
              icon: Icons.alternate_email_rounded,
              iconColor: teal,
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Phone',
              hintText: 'e.g. 9876543210',
              icon: Icons.call_rounded,
              iconColor: teal,
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
            ),
          ],
        ),
        FormSection(
          icon: Icons.cake_rounded,
          color: violet,
          title: 'About',
          subtitle: 'Gender, birthday, blood group, work',
          children: [
            Row(
              children: [
                Expanded(
                  child: AppLabeledField(
                    label: 'Gender',
                    hintText: 'Select gender',
                    icon: Icons.wc_rounded,
                    iconColor: violet,
                    controller: _genderController,
                    readOnly: true,
                    onTap: () => _pickOption(
                      'Gender',
                      _genders,
                      _genderValue,
                      (v) => _genderValue = v,
                      _genderController,
                    ),
                    suffixIcon: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppLabeledField(
                    label: 'Date of birth',
                    hintText: 'Select date',
                    icon: Icons.cake_rounded,
                    iconColor: violet,
                    controller: _dobController,
                    readOnly: true,
                    onTap: _pickDob,
                    suffixIcon: Icon(
                      Icons.calendar_month_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
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
                    hintText: 'Select',
                    icon: Icons.bloodtype_rounded,
                    iconColor: rose,
                    controller: _bloodGroupController,
                    readOnly: true,
                    onTap: () => _pickOption(
                      'Blood group',
                      _bloodGroups,
                      _bloodValue,
                      (v) => _bloodValue = v,
                      _bloodGroupController,
                    ),
                    suffixIcon: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppLabeledField(
                    label: 'Occupation',
                    hintText: 'e.g. Engineer',
                    icon: Icons.work_rounded,
                    iconColor: amber,
                    controller: _occupationController,
                  ),
                ),
              ],
            ),
          ],
        ),
        FormSection(
          icon: Icons.monitor_weight_rounded,
          color: rose,
          title: 'Body',
          subtitle: 'Height and weight',
          children: [
            Row(
              children: [
                Expanded(
                  child: AppLabeledField(
                    label: 'Height (cm)',
                    hintText: 'e.g. 175',
                    icon: Icons.height_rounded,
                    iconColor: rose,
                    controller: _heightController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [numberFormatter],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: AppLabeledField(
                    label: 'Weight (kg)',
                    hintText: 'e.g. 70',
                    icon: Icons.monitor_weight_rounded,
                    iconColor: rose,
                    controller: _weightController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [numberFormatter],
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

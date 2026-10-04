import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_profile_form.dart';
import '../../../models/member_self_profile.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';

/// Member self-service "Edit profile" (web: `/portal/profile`). Backed by
/// `PATCH /portal/profile` — flat keys, ONLY the changed ones are sent
/// (`changedProfileFields`), `currentPassword` joins the body only when the
/// email actually changes. Pops with the server's updated
/// [MemberSelfProfile].
///
/// Dropped on purpose (no endpoint backs them / not member-editable): member
/// ID, status, joining date, branch, trainer and membership are shown
/// read-only under "Managed by your gym"; health/medical info, notes and
/// biometric ID are neither returned nor editable by the member plane.
class MemberEditProfileScreen extends StatefulWidget {
  const MemberEditProfileScreen({super.key, required this.profile});

  final MemberSelfProfile profile;

  @override
  State<MemberEditProfileScreen> createState() =>
      _MemberEditProfileScreenState();
}

class _MemberEditProfileScreenState extends State<MemberEditProfileScreen> {
  late final Map<String, String> _initial;
  late final Map<String, TextEditingController> _ctrl;
  final _password = TextEditingController();
  final _passwordKey = GlobalKey();
  Map<String, String> _errors = {};
  String? _alert;
  bool _saving = false;
  bool _saved = false;
  bool _emailWasChanging = false;

  @override
  void initState() {
    super.initState();
    _initial = widget.profile.toFormValues();
    _ctrl = {
      for (final e in _initial.entries)
        e.key: TextEditingController(text: e.value),
    };
    for (final c in _ctrl.values) {
      c.addListener(_onEdit);
    }
    _password.addListener(_onEdit);
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    _password.dispose();
    super.dispose();
  }

  Map<String, String> get _current =>
      {for (final e in _ctrl.entries) e.key: e.value.text};

  bool get _dirty => changedProfileFields(_initial, _current).isNotEmpty;
  bool get _emailChanging => emailChanged(_initial, _current);

  void _onEdit() {
    if (!mounted) return;
    final changing = _emailChanging;
    setState(() {});
    if (changing && !_emailWasChanging) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _passwordKey.currentContext;
        if (ctx != null && mounted) {
          Scrollable.ensureVisible(
            ctx,
            duration: reduceMotion(ctx)
                ? Duration.zero
                : const Duration(milliseconds: 250),
            alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
          );
        }
      });
    }
    _emailWasChanging = changing;
  }

  Future<void> _save() async {
    if (_saving) return;
    final current = _current;
    final changed = changedProfileFields(_initial, current);
    if (changed.isEmpty) return;
    final errors = validateProfileValues(
      current,
      currentPassword: _password.text,
      emailIsChanging: _emailChanging,
    );
    if (errors.isNotEmpty) {
      setState(() {
        _errors = errors;
        _alert = 'Please fix the highlighted fields.';
      });
      return;
    }
    final body = <String, Object?>{...changed};
    if (_emailChanging) body['currentPassword'] = _password.text;

    setState(() {
      _saving = true;
      _errors = {};
      _alert = null;
    });
    try {
      final updated = await getIt<MemberPortalRepository>().updateProfile(body);
      if (!mounted) return;
      await context.read<SessionCubit>().memberProfileChanged(
            name: updated.name,
            email: updated.email,
            profilePhotoUrl: updated.profilePhotoUrl,
            clearPhoto: updated.profilePhotoUrl == null,
          );
      if (!mounted) return;
      _saved = true;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Profile updated')));
      Navigator.of(context).pop(updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      final fieldMap = <String, String>{};
      for (final f in e.fieldErrors) {
        final key = f.field;
        if (key != null &&
            (_ctrl.containsKey(key) || key == 'currentPassword')) {
          fieldMap[key] = f.message;
        }
      }
      setState(() {
        _errors = fieldMap;
        _alert =
            fieldMap.isEmpty ? e.message : 'Please fix the highlighted fields.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<bool> _confirmDiscard() async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('Discard changes?', style: AppText.display(size: 18)),
        content: Text(
          'You have unsaved changes to your profile.',
          style: AppText.body(size: 14, color: AppColors.inkSoft),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep editing'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    return discard ?? false;
  }

  Widget _text(
    String key,
    String label, {
    TextInputType? keyboardType,
    TextCapitalization caps = TextCapitalization.none,
    List<TextInputFormatter>? formatters,
    int maxLines = 1,
    int? minLines,
    String? hint,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: AppLabeledField(
        label: label,
        controller: _ctrl[key]!,
        keyboardType: keyboardType,
        textCapitalization: caps,
        inputFormatters: formatters,
        errorText: _errors[key],
        textInputAction:
            maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
        maxLines: maxLines,
        minLines: minLines,
        hintText: hint,
      ),
    );
  }

  Widget _select(String key, String label, List<ProfileOption> options) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: _SelectField(
        label: label,
        controller: _ctrl[key]!,
        options: options,
        errorText: _errors[key],
      ),
    );
  }

  Widget _date(String key, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: _DateField(
        label: label,
        controller: _ctrl[key]!,
        errorText: _errors[key],
        lastDate: key == 'dateOfBirth' ? DateTime.now() : DateTime(2100),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dirty = _dirty;
    final emailChanging = _emailChanging;
    final phoneFormatters = [
      FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s-]')),
    ];
    final decimal = [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))];

    return PopScope(
      canPop: !dirty || _saved || _saving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final discard = await _confirmDiscard();
        if (discard && context.mounted) {
          setState(() => _saved = true);
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        resizeToAvoidBottomInset: true,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: Text('Edit profile', style: AppText.display(size: 18)),
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 12),
            child: _SaveButton(
              enabled: dirty && !_saving,
              saving: _saving,
              onPressed: _save,
            ),
          ),
        ),
        body: ListView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
          children: [
            if (_alert != null) ...[
              FormAlert(message: _alert!),
              const SizedBox(height: 12),
            ],
            StaggeredReveal(
              child: _Section(
                title: 'Personal',
                children: [
                  _text(
                    'firstName',
                    'First name',
                    caps: TextCapitalization.words,
                  ),
                  _text(
                    'lastName',
                    'Last name',
                    caps: TextCapitalization.words,
                  ),
                  _date('dateOfBirth', 'Date of birth'),
                  _select('gender', 'Gender', genderOptions),
                  _select('maritalStatus', 'Marital status', maritalOptions),
                  _date('anniversary', 'Anniversary'),
                ],
              ),
            ),
            StaggeredReveal(
              index: 1,
              child: _Section(
                title: 'Contact',
                children: [
                  _text(
                    'phone',
                    'Phone',
                    keyboardType: TextInputType.phone,
                    formatters: phoneFormatters,
                  ),
                  _text('email', 'Email',
                      keyboardType: TextInputType.emailAddress,),
                  if (emailChanging)
                    Padding(
                      key: _passwordKey,
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Changing your email needs your current password, '
                            'so only you can do it.',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: AppColors.inkSoft,
                            ),
                          ),
                          const SizedBox(height: 10),
                          AppLabeledField(
                            label: 'Current password',
                            controller: _password,
                            obscureText: true,
                            errorText: _errors['currentPassword'],
                            autofillHints: const [AutofillHints.password],
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            StaggeredReveal(
              index: 2,
              child: _Section(
                title: 'Address',
                children: [
                  _text(
                    'addressLine',
                    'Address line',
                    caps: TextCapitalization.words,
                  ),
                  _text('city', 'City', caps: TextCapitalization.words),
                  _text('state', 'State', caps: TextCapitalization.words),
                  _text('country', 'Country', caps: TextCapitalization.words),
                  _text('postalCode', 'Postal code'),
                ],
              ),
            ),
            StaggeredReveal(
              index: 3,
              child: _Section(
                title: 'Emergency contact',
                children: [
                  _text(
                    'emergencyContactName',
                    'Name',
                    caps: TextCapitalization.words,
                  ),
                  _text(
                    'emergencyContactPhone',
                    'Phone',
                    keyboardType: TextInputType.phone,
                    formatters: phoneFormatters,
                  ),
                  _text(
                    'emergencyContactRelation',
                    'Relation',
                    caps: TextCapitalization.words,
                    hint: 'e.g. Spouse',
                  ),
                ],
              ),
            ),
            StaggeredReveal(
              index: 4,
              child: _Section(
                title: 'Fitness profile',
                children: [
                  _select('goal', 'Goal', goalOptions),
                  _select('bodyType', 'Body type', bodyTypeOptions),
                  _select(
                    'foodPreference',
                    'Food preference',
                    foodPreferenceOptions,
                  ),
                  _text(
                    'fitnessGoals',
                    'Fitness goals',
                    caps: TextCapitalization.sentences,
                    minLines: 3,
                    maxLines: 6,
                    hint: 'e.g. Run a 10K by March',
                  ),
                  _text(
                    'occupation',
                    'Occupation',
                    caps: TextCapitalization.words,
                  ),
                  _select('bloodGroup', 'Blood group', bloodGroupOptions),
                  _text(
                    'height',
                    'Height (cm)',
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    formatters: decimal,
                  ),
                  _text(
                    'weight',
                    'Weight (kg)',
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    formatters: decimal,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 2),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppText.display(size: 15)),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

/// Tap-to-choose field (bottom sheet of 56dp rows). The controller holds the
/// API enum value; '' means not set.
class _SelectField extends StatelessWidget {
  const _SelectField({
    required this.label,
    required this.controller,
    required this.options,
    this.errorText,
  });

  final String label;
  final TextEditingController controller;
  final List<ProfileOption> options;
  final String? errorText;

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.8,
          ),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(8, 14, 8, 10),
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 12, bottom: 6),
                child: Text(label, style: AppText.eyebrow()),
              ),
              for (final o in options)
                _OptionRow(
                  label: o.label,
                  selected: o.value == controller.text,
                  onTap: () => Navigator.of(ctx).pop(o.value),
                ),
              if (controller.text.isNotEmpty)
                _OptionRow(
                  label: 'Clear',
                  selected: false,
                  color: AppColors.danger,
                  onTap: () => Navigator.of(ctx).pop(''),
                ),
            ],
          ),
        ),
      ),
    );
    if (picked != null) controller.text = picked;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final value = controller.text;
        return _FieldShell(
          label: label,
          errorText: errorText,
          onTap: () => _open(context),
          trailing: const Icon(
            Icons.expand_more_rounded,
            size: 20,
            color: AppColors.inkFaint,
          ),
          child: Text(
            value.isEmpty ? 'Not set' : optionLabel(options, value),
            style: AppText.body(
              size: 15,
              weight: FontWeight.w600,
              color: value.isEmpty ? AppColors.inkFaint : AppColors.ink,
            ),
          ),
        );
      },
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
    this.color = AppColors.ink,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.field),
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: AppText.body(
                      size: 15,
                      weight: selected ? FontWeight.w800 : FontWeight.w600,
                      color: color,
                    ),
                  ),
                ),
                if (selected)
                  const Icon(
                    Icons.check_rounded,
                    size: 20,
                    color: AppColors.memberB,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// '2026-10-03' -> '3 Oct 2026' (falls back to the raw text).
String formatProfileDate(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  return '${d.day} ${_months[d.month - 1]} ${d.year}';
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.controller,
    required this.lastDate,
    this.errorText,
  });

  final String label;
  final TextEditingController controller;
  final DateTime lastDate;
  final String? errorText;

  Future<void> _pick(BuildContext context) async {
    final existing = DateTime.tryParse(controller.text);
    final now = DateTime.now();
    var initial = existing ?? DateTime(now.year - 25, now.month, now.day);
    if (initial.isAfter(lastDate)) initial = lastDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: lastDate,
    );
    if (picked == null) return;
    controller.text = '${picked.year.toString().padLeft(4, '0')}-'
        '${picked.month.toString().padLeft(2, '0')}-'
        '${picked.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final value = controller.text;
        return _FieldShell(
          label: label,
          errorText: errorText,
          onTap: () => _pick(context),
          trailing: value.isEmpty
              ? const Icon(
                  Icons.calendar_today_outlined,
                  size: 18,
                  color: AppColors.inkFaint,
                )
              : Semantics(
                  button: true,
                  label: 'Clear $label',
                  child: InkResponse(
                    onTap: () => controller.clear(),
                    radius: 24,
                    child: const SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ),
          child: Text(
            value.isEmpty ? 'Not set' : formatProfileDate(value),
            style: AppText.body(
              size: 15,
              weight: FontWeight.w600,
              color: value.isEmpty ? AppColors.inkFaint : AppColors.ink,
            ),
          ),
        );
      },
    );
  }
}

/// Visual twin of [AppLabeledField] for tap-to-choose rows (caption above,
/// surface2 box, 52dp minimum height).
class _FieldShell extends StatelessWidget {
  const _FieldShell({
    required this.label,
    required this.child,
    required this.onTap,
    required this.trailing,
    this.errorText,
  });

  final String label;
  final Widget child;
  final VoidCallback onTap;
  final Widget trailing;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final hasError = errorText != null && errorText!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(label, style: AppText.eyebrow()),
        ),
        Material(
          color: AppColors.surface2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.field),
            side: BorderSide(
              color: hasError ? AppColors.danger : AppColors.line,
            ),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.field),
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Padding(
                padding: const EdgeInsets.only(left: 14, right: 6),
                child: Row(
                  children: [
                    Expanded(child: child),
                    trailing,
                    const SizedBox(width: 8),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 2),
            child: Text(
              errorText!,
              style: AppText.body(
                size: 12,
                color: AppColors.danger,
                weight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}

class _SaveButton extends StatelessWidget {
  const _SaveButton({
    required this.enabled,
    required this.saving,
    required this.onPressed,
  });

  final bool enabled;
  final bool saving;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled || saving ? 1 : 0.45,
      child: Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(
            gradient: AppColors.memberGrad,
            borderRadius: BorderRadius.circular(AppRadii.button),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.button),
            onTap: enabled ? onPressed : null,
            child: SizedBox(
              height: 52,
              width: double.infinity,
              child: Center(
                child: saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: AppColors.memberOnGrad,
                        ),
                      )
                    : Text(
                        'Save changes',
                        style: AppText.body(
                          size: 15,
                          weight: FontWeight.w800,
                          color: AppColors.memberOnGrad,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

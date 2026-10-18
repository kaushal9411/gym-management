import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_profile_form.dart';

/// Tap-to-choose field (bottom sheet of 56dp rows). The controller holds the
/// API enum value; '' means not set.
class ProfileSelectField extends StatelessWidget {
  const ProfileSelectField({
    super.key,
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
                ProfileOptionRow(
                  label: o.label,
                  selected: o.value == controller.text,
                  onTap: () => Navigator.of(ctx).pop(o.value),
                ),
              if (controller.text.isNotEmpty)
                ProfileOptionRow(
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
        return ProfileFieldShell(
          label: label,
          errorText: errorText,
          onTap: () => _open(context),
          trailing: Icon(
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

class ProfileOptionRow extends StatelessWidget {
  ProfileOptionRow({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    Color? color,
  }) : color = color ?? AppColors.ink;

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

class ProfileDateField extends StatelessWidget {
  const ProfileDateField({
    super.key,
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
        return ProfileFieldShell(
          label: label,
          errorText: errorText,
          onTap: () => _pick(context),
          trailing: value.isEmpty
              ? Icon(
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
                    child: SizedBox(
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
class ProfileFieldShell extends StatelessWidget {
  const ProfileFieldShell({
    super.key,
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

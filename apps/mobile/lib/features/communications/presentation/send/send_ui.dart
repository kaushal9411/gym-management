import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../comm_constants.dart';

/// A plan or branch the audience can be narrowed to.
class LookupItem {
  const LookupItem(this.id, this.name);

  final String id;
  final String name;
}

/// Plans and branches for the audience filters. A list is null when it could
/// not be loaded (for example the viewer lacks `plans:view` / `branches:view`
/// — the Communications API has no lookup of its own), in which case that
/// filter group is simply not offered.
class AudienceLookups {
  const AudienceLookups({this.plans, this.branches});

  final List<LookupItem>? plans;
  final List<LookupItem>? branches;

  static const none = AudienceLookups();

  /// id -> name for the review summary.
  Map<String, String> get names => {
        for (final p in plans ?? const <LookupItem>[]) p.id: p.name,
        for (final b in branches ?? const <LookupItem>[]) b.id: b.name,
      };
}

/// The "question" heading + hint of a step (`h3.q` + `.hint`).
class StepHeading extends StatelessWidget {
  const StepHeading({super.key, required this.title, this.hint});

  final String title;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(
            title,
            style: AppText.display(size: 20, weight: FontWeight.w800),
          ),
        ),
        if (hint != null)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              hint!,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
          ),
        const SizedBox(height: 12),
      ],
    );
  }
}

/// Small red text under a field (inline validation).
class InlineError extends StatelessWidget {
  const InlineError(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 5, left: 2),
      child: Semantics(
        liveRegion: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 1),
              child: Icon(
                Icons.error_outline_rounded,
                size: 14,
                color: AppColors.danger,
              ),
            ),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                text,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: AppColors.danger,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Input decoration shared by the flow's text fields (`.in`).
InputDecoration commFieldDecoration({
  String? hint,
  bool error = false,
  Widget? prefix,
}) {
  OutlineInputBorder border(Color c, {double w = 1}) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.field - 2),
        borderSide: BorderSide(color: c, width: w),
      );
  return InputDecoration(
    hintText: hint,
    hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
    filled: true,
    fillColor: AppColors.surface2,
    isDense: true,
    prefixIcon: prefix,
    counterText: '',
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: border(error ? AppColors.danger : AppColors.line),
    enabledBorder: border(error ? AppColors.danger : AppColors.line),
    focusedBorder: border(error ? AppColors.danger : kCommBrand, w: 1.5),
  );
}

/// Field label above an input (`.field label`).
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.trailing});

  final String text;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5, left: 1),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: AppText.body(size: 12.5, weight: FontWeight.w700),
            ),
          ),
          if (trailing != null)
            Text(
              trailing!,
              style: AppText.tabular(
                size: 11,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
        ],
      ),
    );
  }
}

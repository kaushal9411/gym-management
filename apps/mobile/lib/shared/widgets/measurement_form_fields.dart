import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/body_measurement.dart';

/// Mutable field-value bag for the measurement create/edit form — mirrors
/// web's `BodyMeasurementFormValues`. `MeasurementFormFields` owns the
/// controllers so callers just read `.toInput()` on submit.
class MeasurementFormController {
  MeasurementFormController({BodyMeasurement? initial}) {
    if (initial != null) {
      weightKg.text = initial.weightKg?.toString() ?? '';
      heightCm.text = initial.heightCm?.toString() ?? '';
      bodyFatPercent.text = initial.bodyFatPercent?.toString() ?? '';
      chestCm.text = initial.chestCm?.toString() ?? '';
      waistCm.text = initial.waistCm?.toString() ?? '';
      hipsCm.text = initial.hipsCm?.toString() ?? '';
      bicepsCm.text = initial.bicepsCm?.toString() ?? '';
      thighsCm.text = initial.thighsCm?.toString() ?? '';
      notes.text = initial.notes ?? '';
    }
  }

  final weightKg = TextEditingController();
  final heightCm = TextEditingController();
  final bodyFatPercent = TextEditingController();
  final chestCm = TextEditingController();
  final waistCm = TextEditingController();
  final hipsCm = TextEditingController();
  final bicepsCm = TextEditingController();
  final thighsCm = TextEditingController();
  final notes = TextEditingController();

  BodyMeasurementFormInput toInput() {
    double? num(TextEditingController c) => double.tryParse(c.text.trim());
    return BodyMeasurementFormInput(
      weightKg: num(weightKg),
      heightCm: num(heightCm),
      bodyFatPercent: num(bodyFatPercent),
      chestCm: num(chestCm),
      waistCm: num(waistCm),
      hipsCm: num(hipsCm),
      bicepsCm: num(bicepsCm),
      thighsCm: num(thighsCm),
      notes: notes.text.trim().isEmpty ? null : notes.text.trim(),
    );
  }

  void dispose() {
    weightKg.dispose();
    heightCm.dispose();
    bodyFatPercent.dispose();
    chestCm.dispose();
    waistCm.dispose();
    hipsCm.dispose();
    bicepsCm.dispose();
    thighsCm.dispose();
    notes.dispose();
  }
}

/// Same field grid as `member_detail_screen.dart`'s embedded card form —
/// extracted so `NewMeasurementScreen` and `MemberMeasurementsDetailScreen`
/// can share it instead of re-declaring the 9-field layout.
class MeasurementFormFields extends StatelessWidget {
  const MeasurementFormFields({super.key, required this.controller});

  final MeasurementFormController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _Field(label: 'Weight (kg)', controller: controller.weightKg),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _Field(label: 'Height (cm)', controller: controller.heightCm),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _Field(label: 'Body fat (%)', controller: controller.bodyFatPercent),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _Field(label: 'Chest (cm)', controller: controller.chestCm),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _Field(label: 'Waist (cm)', controller: controller.waistCm),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _Field(label: 'Hips (cm)', controller: controller.hipsCm),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _Field(label: 'Biceps (cm)', controller: controller.bicepsCm),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _Field(label: 'Thighs (cm)', controller: controller.thighsCm),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          'Notes',
          style: AppText.body(size: 11, color: AppColors.inkFaint, weight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller.notes,
          style: AppText.body(size: 14, weight: FontWeight.w600),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: AppColors.surface3,
            hintText: 'Optional',
            hintStyle: AppText.body(color: AppColors.inkFaint),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppText.body(size: 11, color: AppColors.inkFaint, weight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
          ],
          style: AppText.body(size: 14, weight: FontWeight.w600),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: AppColors.surface3,
            hintText: '—',
            hintStyle: AppText.body(color: AppColors.inkFaint),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }
}

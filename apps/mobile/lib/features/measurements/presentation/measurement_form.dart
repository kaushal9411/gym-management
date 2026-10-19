import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/network/api_exception.dart';
import '../../../models/body_measurement.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'measurement_ui.dart';

/// Field values for the measurement record / edit form — mirrors web's
/// `BodyMeasurementFormValues` (date, the eight values, notes). Owns its
/// text controllers; whoever creates it must dispose it from a `State`
/// (never in the same frame the fields are removed).
class MeasurementFormController extends ChangeNotifier {
  MeasurementFormController({BodyMeasurement? initial}) {
    final day = initial == null ? DateTime.now() : entryDay(initial.recordedAt);
    date = DateTime(day.year, day.month, day.day);
    for (final f in MeasurementField.values) {
      final v = initial == null ? null : f.of(initial);
      _controllers[f] = TextEditingController(text: v == null ? '' : fmtNum(v));
    }
    notes = TextEditingController(text: initial?.notes ?? '');
  }

  final _controllers = <MeasurementField, TextEditingController>{};
  late final TextEditingController notes;

  /// Calendar day of the measurement (date only, like web's `<input type=date>`).
  late DateTime date;

  TextEditingController of(MeasurementField f) => _controllers[f]!;

  void setDate(DateTime d) {
    date = DateTime(d.year, d.month, d.day);
    notifyListeners();
  }

  /// First problem with what was typed, or null. Bounds mirror the API's
  /// validators: everything must be > 0 (body fat may be 0) and under its
  /// cap; comma decimals are fine.
  String? validate() {
    for (final f in MeasurementField.values) {
      final text = of(f).text.trim();
      if (text.isEmpty) continue;
      final v = parseMeasurementNumber(text);
      if (v == null || v.isNaN || v.isInfinite) {
        return '${f.label} must be a number.';
      }
      if (f.allowZero ? v < 0 : v <= 0) {
        return f.allowZero
            ? '${f.label} cannot be negative.'
            : '${f.label} must be greater than 0.';
      }
      if (v > f.max) {
        return '${f.label} cannot be more than ${fmtNum(f.max)} ${f.unit}.';
      }
    }
    if (notes.text.trim().length > 1000) {
      return 'Notes cannot be longer than 1000 characters.';
    }
    return null;
  }

  /// The create / update body. Empty fields are omitted (the API cannot
  /// clear a value through PATCH, same as web).
  BodyMeasurementFormInput toInput() {
    double? n(MeasurementField f) => parseMeasurementNumber(of(f).text);
    final note = notes.text.trim();
    return BodyMeasurementFormInput(
      recordedAt: DateTime.utc(date.year, date.month, date.day),
      weightKg: n(MeasurementField.weight),
      heightCm: n(MeasurementField.height),
      bodyFatPercent: n(MeasurementField.bodyFat),
      chestCm: n(MeasurementField.chest),
      waistCm: n(MeasurementField.waist),
      hipsCm: n(MeasurementField.hips),
      bicepsCm: n(MeasurementField.biceps),
      thighsCm: n(MeasurementField.thighs),
      notes: note.isEmpty ? null : note,
    );
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    notes.dispose();
    super.dispose();
  }
}

/// The shared field grid: date, body composition, girths, notes. Used by the
/// Record-a-measurement page and by the inline record / edit form on a
/// member's measurement page (web's `MeasurementFormFields`).
class MeasurementFormFields extends StatelessWidget {
  const MeasurementFormFields({
    super.key,
    required this.controller,
    this.enabled = true,
    this.firstDate,
    this.lastDate,
  });

  final MeasurementFormController controller;
  final bool enabled;

  /// Date-picker bounds (the member plane limits logging to today and 365
  /// days back); unbounded when null, as on the staff screens.
  final DateTime? firstDate;
  final DateTime? lastDate;

  static final _decimal = [
    FilteringTextInputFormatter.allow(RegExp(r'^\d*[.,]?\d{0,2}')),
  ];

  Widget _field(MeasurementField f) => AppLabeledField(
        key: ValueKey('mf-${f.name}'),
        label: f.formLabel,
        controller: controller.of(f),
        icon: f.icon,
        iconColor: f.color,
        hintText: '—',
        readOnly: !enabled,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: _decimal,
      );

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 640 ? 3 : 2;
        final w = (c.maxWidth - 12 * (cols - 1)) / cols;
        Widget grid(List<MeasurementField> fields) => Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final f in fields) SizedBox(width: w, child: _field(f)),
              ],
            );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: c.maxWidth >= 640 ? w : c.maxWidth,
              child: ListenableBuilder(
                listenable: controller,
                builder: (context, _) => TeamDateField(
                  label: 'Date',
                  icon: Icons.event_rounded,
                  iconColor: TeamColors.indigo,
                  value: controller.date,
                  firstDate: firstDate,
                  lastDate: lastDate,
                  clearable: false,
                  onChanged: (d) {
                    if (enabled && d != null) controller.setDate(d);
                  },
                ),
              ),
            ),
            const TeamGroupLabel('BODY COMPOSITION'),
            grid(const [
              MeasurementField.weight,
              MeasurementField.height,
              MeasurementField.bodyFat,
            ]),
            const SizedBox(height: 8),
            const TeamGroupLabel('GIRTHS'),
            grid([
              for (final f in MeasurementField.values)
                if (f.isGirth) f,
            ]),
            const SizedBox(height: 14),
            AppLabeledField(
              key: const ValueKey('mf-notes'),
              label: 'Notes',
              controller: controller.notes,
              icon: Icons.notes_rounded,
              iconColor: TeamColors.slate,
              hintText: 'Optional',
              readOnly: !enabled,
              minLines: 1,
              maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
              inputFormatters: [LengthLimitingTextInputFormatter(1000)],
            ),
          ],
        );
      },
    );
  }
}

/// Self-contained inline form (fields + inline error + Save / Cancel) for the
/// member measurement page — records a new entry, or edits [initial]. Owns
/// (and disposes) its controller.
class MeasurementEntryForm extends StatefulWidget {
  const MeasurementEntryForm({
    super.key,
    required this.onSubmit,
    required this.onCancel,
    this.initial,
    this.saveLabel = 'Save measurement',
  });

  final BodyMeasurement? initial;
  final String saveLabel;

  /// Runs the request; throws [ApiException] (or anything) on failure.
  final Future<void> Function(BodyMeasurementFormInput input) onSubmit;
  final VoidCallback onCancel;

  @override
  State<MeasurementEntryForm> createState() => _MeasurementEntryFormState();
}

class _MeasurementEntryFormState extends State<MeasurementEntryForm> {
  late final MeasurementFormController _form =
      MeasurementFormController(initial: widget.initial);
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final problem = _form.validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSubmit(_form.toInput());
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save the measurement. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: TeamColors.indigo.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: TeamColors.indigo.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          MeasurementFormFields(controller: _form, enabled: !_saving),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TeamOutlineButton(
                  label: 'Cancel',
                  onTap: _saving ? null : widget.onCancel,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: TeamGradientButton(
                  label: widget.saveLabel,
                  icon: Icons.check_rounded,
                  loading: _saving,
                  gradient: TeamColors.ctaGreen,
                  onTap: _saving ? null : _save,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

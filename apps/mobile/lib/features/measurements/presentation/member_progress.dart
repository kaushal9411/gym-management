import '../../../models/body_measurement.dart';
import 'measurement_ui.dart';

/// Which direction of change is "good" for a value (web's `lowerIsBetter`);
/// null means neutral (weight, girths that are not a health marker).
bool? lowerIsBetter(MeasurementField f) => switch (f) {
      MeasurementField.bodyFat || MeasurementField.waist => true,
      _ => null,
    };

double r1(double n) => (n * 10).round() / 10;

/// The numbers behind the member's own Body Measurements page — everything
/// web's `MeasurementsPageContent` derives client-side from
/// `GET /portal/measurements`. Pure Dart so it can be unit-tested.
class MemberProgress {
  MemberProgress(Iterable<BodyMeasurement> entries)
      : asc = (entries.toList()
          ..sort((a, b) => a.recordedAt.compareTo(b.recordedAt)));

  /// Oldest first.
  final List<BodyMeasurement> asc;

  /// Entries with at least one value — the only ones that can be analysed
  /// (an empty check-in stays visible in nothing, like web).
  late final List<BodyMeasurement> valued = [
    for (final e in asc)
      if (MeasurementField.values.any((f) => f.of(e) != null)) e,
  ];

  bool get isEmpty => valued.isEmpty;
  BodyMeasurement? get first => valued.isEmpty ? null : valued.first;
  BodyMeasurement? get latest => valued.isEmpty ? null : valued.last;
  BodyMeasurement? get previous =>
      valued.length > 1 ? valued[valued.length - 2] : null;

  /// Newest first, for the History list.
  List<BodyMeasurement> get history => asc.reversed.toList();

  double? valueOf(BodyMeasurement? e, MeasurementField f) =>
      e == null ? null : f.of(e);

  /// `a - b` rounded to one decimal; null when either side is missing.
  double? diff(BodyMeasurement? a, BodyMeasurement? b, MeasurementField f) {
    final x = valueOf(a, f);
    final y = valueOf(b, f);
    return x == null || y == null ? null : r1(x - y);
  }

  /// Most recent recorded height, to compute BMI for entries without one.
  double? get heightLatest {
    for (final e in asc.reversed) {
      if (e.heightCm != null) return e.heightCm;
    }
    return null;
  }

  /// BMI computed on the device from real weight + height (never stored).
  double? bmiOf(BodyMeasurement? e) {
    final w = valueOf(e, MeasurementField.weight);
    final h = e?.heightCm ?? heightLatest;
    if (w == null || h == null || h == 0) return null;
    return r1(w / ((h / 100) * (h / 100)));
  }

  static String bmiBand(double bmi) => bmi < 18.5
      ? 'Underweight'
      : bmi < 25
          ? 'Healthy range'
          : bmi < 30
              ? 'Overweight'
              : 'Obese';

  /// Entries within the last [days] days (null = all time).
  List<BodyMeasurement> inRange(int? days, {DateTime? now}) {
    if (days == null) return valued;
    final cutoff = (now ?? DateTime.now()).subtract(Duration(days: days));
    return [
      for (final e in valued)
        if (!e.recordedAt.isBefore(cutoff)) e,
    ];
  }
}

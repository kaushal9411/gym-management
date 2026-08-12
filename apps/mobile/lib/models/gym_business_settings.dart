enum MeasurementUnit { metric, imperial }

extension MeasurementUnitX on MeasurementUnit {
  String get apiValue => this == MeasurementUnit.metric ? 'METRIC' : 'IMPERIAL';

  String get label => this == MeasurementUnit.metric ? 'Metric' : 'Imperial';

  static MeasurementUnit fromApi(String v) =>
      v == 'IMPERIAL' ? MeasurementUnit.imperial : MeasurementUnit.metric;
}

/// Mirrors `BusinessSettingsDto` (`GET/PATCH /settings/business`).
class GymBusinessSettings {
  const GymBusinessSettings({
    required this.currency,
    required this.currencySymbol,
    required this.timezone,
    required this.dateFormat,
    required this.timeFormat,
    required this.measurementUnit,
  });

  final String currency;
  final String currencySymbol;
  final String timezone;
  final String dateFormat;
  final String timeFormat;
  final MeasurementUnit measurementUnit;

  factory GymBusinessSettings.fromJson(Map<String, dynamic> json) =>
      GymBusinessSettings(
        currency: json['currency'] as String,
        currencySymbol: json['currencySymbol'] as String,
        timezone: json['timezone'] as String,
        dateFormat: json['dateFormat'] as String,
        timeFormat: json['timeFormat'] as String,
        measurementUnit:
            MeasurementUnitX.fromApi(json['measurementUnit'] as String),
      );
}

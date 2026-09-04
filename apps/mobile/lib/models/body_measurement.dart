/// Mirrors `BodyMeasurementDto` — a trainer/owner/manager-logged snapshot of
/// a member's body measurements at a point in time (the historical trend
/// log). Distinct from `GymMember.height`/`GymMember.weight` (a single
/// current-value snapshot on the profile itself). Every numeric field is
/// optional — an entry can log just a weight, just a body-fat%, or the full
/// set — and arrives from the API as a Decimal-formatted string (same
/// convention as `GymMember.priceAtAssignment`/`MemberInvoice.totalAmount`),
/// parsed here to `double?` since the UI only ever displays these, never
/// re-serializes them.
class BodyMeasurementRecorder {
  const BodyMeasurementRecorder({required this.id, required this.name});

  final String id;
  final String name;

  factory BodyMeasurementRecorder.fromJson(Map<String, dynamic> json) =>
      BodyMeasurementRecorder(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class BodyMeasurement {
  const BodyMeasurement({
    required this.id,
    required this.memberId,
    required this.recordedAt,
    required this.weightKg,
    required this.heightCm,
    required this.bodyFatPercent,
    required this.chestCm,
    required this.waistCm,
    required this.hipsCm,
    required this.bicepsCm,
    required this.thighsCm,
    required this.notes,
    required this.recordedBy,
  });

  final String id;
  final String memberId;
  final DateTime recordedAt;
  final double? weightKg;
  final double? heightCm;
  final double? bodyFatPercent;
  final double? chestCm;
  final double? waistCm;
  final double? hipsCm;
  final double? bicepsCm;
  final double? thighsCm;
  final String? notes;
  final BodyMeasurementRecorder? recordedBy;

  static double? _num(dynamic v) =>
      v == null ? null : double.tryParse(v as String);

  factory BodyMeasurement.fromJson(Map<String, dynamic> json) =>
      BodyMeasurement(
        id: json['id'] as String,
        memberId: json['memberId'] as String,
        recordedAt: DateTime.parse(json['recordedAt'] as String),
        weightKg: _num(json['weightKg']),
        heightCm: _num(json['heightCm']),
        bodyFatPercent: _num(json['bodyFatPercent']),
        chestCm: _num(json['chestCm']),
        waistCm: _num(json['waistCm']),
        hipsCm: _num(json['hipsCm']),
        bicepsCm: _num(json['bicepsCm']),
        thighsCm: _num(json['thighsCm']),
        notes: json['notes'] as String?,
        recordedBy: json['recordedBy'] == null
            ? null
            : BodyMeasurementRecorder.fromJson(
                json['recordedBy'] as Map<String, dynamic>,
              ),
      );

  /// Compact one-line summary of whichever fields were actually recorded —
  /// mirrors tenant-web's `summarizeMeasurement` util.
  String get summary {
    final parts = <String>[
      if (weightKg != null) '${_trim(weightKg!)} kg',
      if (heightCm != null) '${_trim(heightCm!)} cm',
      if (bodyFatPercent != null) '${_trim(bodyFatPercent!)}% fat',
      if (chestCm != null) 'Chest ${_trim(chestCm!)}',
      if (waistCm != null) 'Waist ${_trim(waistCm!)}',
      if (hipsCm != null) 'Hips ${_trim(hipsCm!)}',
      if (bicepsCm != null) 'Biceps ${_trim(bicepsCm!)}',
      if (thighsCm != null) 'Thighs ${_trim(thighsCm!)}',
    ];
    return parts.isEmpty ? 'No values recorded' : parts.join(' · ');
  }

  static String _trim(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
}

/// Full create/update field set — mirrors web's `CreateBodyMeasurementPayload`.
/// One input class for both create (`POST`) and update (`PATCH`), same
/// "submit the complete current state" convention as `WorkoutPlanFormInput`.
class BodyMeasurementFormInput {
  const BodyMeasurementFormInput({
    this.recordedAt,
    this.weightKg,
    this.heightCm,
    this.bodyFatPercent,
    this.chestCm,
    this.waistCm,
    this.hipsCm,
    this.bicepsCm,
    this.thighsCm,
    this.notes,
  });

  final DateTime? recordedAt;
  final double? weightKg;
  final double? heightCm;
  final double? bodyFatPercent;
  final double? chestCm;
  final double? waistCm;
  final double? hipsCm;
  final double? bicepsCm;
  final double? thighsCm;
  final String? notes;

  Map<String, dynamic> toJson() => {
        if (recordedAt != null) 'recordedAt': recordedAt!.toIso8601String(),
        if (weightKg != null) 'weightKg': weightKg,
        if (heightCm != null) 'heightCm': heightCm,
        if (bodyFatPercent != null) 'bodyFatPercent': bodyFatPercent,
        if (chestCm != null) 'chestCm': chestCm,
        if (waistCm != null) 'waistCm': waistCm,
        if (hipsCm != null) 'hipsCm': hipsCm,
        if (bicepsCm != null) 'bicepsCm': bicepsCm,
        if (thighsCm != null) 'thighsCm': thighsCm,
        if (notes != null) 'notes': notes,
      };
}

/// One entry in the Body Measurements catalog — a member who has at least
/// one recorded measurement, paired with their latest reading and a total
/// count. Mirrors `MeasuredMemberDto` — backs `MeasuredMembersScreen`,
/// deliberately not the full member roster (there's no reusable template
/// the way Workout/Diet Plans have, so "who actually has history" is the
/// only useful catalog view).
class MeasuredMemberOption {
  const MeasuredMemberOption({
    required this.memberId,
    required this.memberName,
    required this.memberCode,
    required this.profilePhotoUrl,
    required this.branchName,
    required this.trainerName,
    required this.latest,
    required this.count,
  });

  final String memberId;
  final String memberName;
  final String memberCode;
  final String? profilePhotoUrl;
  final String branchName;
  final String? trainerName;
  final BodyMeasurement latest;
  final int count;

  factory MeasuredMemberOption.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>;
    final trainer = member['trainer'] as Map<String, dynamic>?;
    return MeasuredMemberOption(
      memberId: member['id'] as String,
      memberName: member['name'] as String,
      memberCode: member['memberId'] as String,
      profilePhotoUrl: member['profilePhotoUrl'] as String?,
      branchName: (member['branch'] as Map<String, dynamic>)['name'] as String,
      trainerName: trainer?['name'] as String?,
      latest: BodyMeasurement.fromJson(json['latest'] as Map<String, dynamic>),
      count: json['count'] as int,
    );
  }
}

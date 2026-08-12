class QrValidationMember {
  const QrValidationMember({
    required this.id,
    required this.memberId,
    required this.name,
    required this.status,
  });

  final String id;
  final String memberId;
  final String name;
  final String status;

  factory QrValidationMember.fromJson(Map<String, dynamic> json) =>
      QrValidationMember(
        id: json['id'] as String,
        memberId: json['memberId'] as String,
        name: json['name'] as String,
        status: json['status'] as String,
      );
}

/// Mirrors `QrValidationResultDto` (`POST /attendance/validate-qr`).
class QrValidationResult {
  const QrValidationResult({
    required this.valid,
    required this.reason,
    required this.member,
    required this.alreadyCheckedIn,
  });

  final bool valid;
  final String? reason;
  final QrValidationMember? member;
  final bool alreadyCheckedIn;

  factory QrValidationResult.fromJson(Map<String, dynamic> json) =>
      QrValidationResult(
        valid: json['valid'] as bool,
        reason: json['reason'] as String?,
        member: json['member'] == null
            ? null
            : QrValidationMember.fromJson(
                json['member'] as Map<String, dynamic>,
              ),
        alreadyCheckedIn: json['alreadyCheckedIn'] as bool,
      );
}

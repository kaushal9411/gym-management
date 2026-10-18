/// Mirrors `AttendanceReportRow` (`GET /reports/attendance`) — one check-in.
///
/// `date` is the branch-local calendar day (`YYYY-MM-DD`, never shifted);
/// `checkInTime` / `checkOutTime` are UTC ISO timestamps shown in local time.
class AttendanceReportRow {
  const AttendanceReportRow({
    required this.date,
    required this.memberCode,
    required this.name,
    required this.branch,
    required this.checkIn,
    required this.checkOut,
    required this.method,
  });

  final String date;
  final String memberCode;
  final String name;
  final String branch;
  final DateTime? checkIn;
  final DateTime? checkOut;

  /// `QR_CODE`, `MANUAL`, `BIOMETRIC`, `FACE_RECOGNITION`, `NFC`, `RFID`.
  final String method;

  /// Time inside the gym; null while not checked out (or on bad data).
  Duration? get duration {
    final a = checkIn;
    final b = checkOut;
    if (a == null || b == null || b.isBefore(a)) return null;
    return b.difference(a);
  }

  factory AttendanceReportRow.fromJson(Map<String, dynamic> json) =>
      AttendanceReportRow(
        date: json['date']?.toString() ?? '',
        memberCode: json['memberCode']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        branch: json['branch']?.toString() ?? '',
        checkIn:
            DateTime.tryParse(json['checkInTime']?.toString() ?? '')?.toLocal(),
        checkOut: DateTime.tryParse(json['checkOutTime']?.toString() ?? '')
            ?.toLocal(),
        method: json['method']?.toString() ?? 'MANUAL',
      );
}

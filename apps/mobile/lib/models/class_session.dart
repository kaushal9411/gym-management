class ClassSessionSummary {
  const ClassSessionSummary({required this.id, required this.name});

  final String id;
  final String name;

  factory ClassSessionSummary.fromJson(Map<String, dynamic> json) =>
      ClassSessionSummary(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

/// Mirrors `ClassSessionDto` (`GET /class-sessions`, `GET /portal/classes`).
class ClassSession {
  const ClassSession({
    required this.id,
    required this.groupClass,
    required this.trainer,
    required this.sessionDate,
    required this.startTime,
    required this.endTime,
    required this.capacity,
    required this.bookedCount,
    required this.status,
    this.branch,
  });

  final String id;
  final ClassSessionSummary groupClass;
  final ClassSessionSummary? trainer;

  /// The branch the session runs at (`{id, name}`), as web's calendar dialog
  /// and the member page show it. Nullable so older payloads still parse.
  final ClassSessionSummary? branch;
  final String sessionDate;
  final String startTime;
  final String endTime;
  final int capacity;
  final int bookedCount;

  /// `SCHEDULED` / `CANCELLED` / `COMPLETED`.
  final String status;

  bool get isScheduled => status == 'SCHEDULED';
  bool get isFull => bookedCount >= capacity;

  /// `YYYY-MM-DD` (the wire value may carry a time part).
  String get dayKey =>
      sessionDate.length >= 10 ? sessionDate.substring(0, 10) : sessionDate;

  factory ClassSession.fromJson(Map<String, dynamic> json) => ClassSession(
        id: json['id'] as String,
        groupClass: ClassSessionSummary.fromJson(
          json['groupClass'] as Map<String, dynamic>,
        ),
        trainer: json['trainer'] == null
            ? null
            : ClassSessionSummary.fromJson(
                json['trainer'] as Map<String, dynamic>,
              ),
        branch: json['branch'] is Map<String, dynamic>
            ? ClassSessionSummary.fromJson(
                json['branch'] as Map<String, dynamic>,
              )
            : null,
        sessionDate: json['sessionDate'] as String,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        capacity: (json['capacity'] as num).toInt(),
        bookedCount: (json['bookedCount'] as num).toInt(),
        status: json['status'] as String,
      );
}

/// One booking row of a session (`ClassBookingDto`).
class ClassBooking {
  const ClassBooking({
    required this.id,
    required this.memberId,
    required this.memberName,
    required this.status,
    this.memberCode,
    this.bookedByRole,
    this.bookedAt,
  });

  /// The booking id (`POST /bookings/:id/cancel`).
  final String id;

  /// The member's uuid (what `POST /bookings` takes).
  final String memberId;
  final String memberName;

  /// `BOOKED` / `CANCELLED` / `ATTENDED` / `NO_SHOW`.
  final String status;

  /// Human member code (`MEM-0001`) — `member.memberId` on the wire.
  final String? memberCode;

  /// `STAFF` or `MEMBER` — who made the booking.
  final String? bookedByRole;
  final DateTime? bookedAt;

  factory ClassBooking.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>;
    return ClassBooking(
      id: json['id'] as String,
      memberId: member['id'] as String,
      memberName: member['name'] as String,
      status: json['status'] as String,
      memberCode: member['memberId'] as String?,
      bookedByRole: json['bookedByRole'] as String?,
      bookedAt: json['bookedAt'] == null
          ? null
          : DateTime.tryParse(json['bookedAt'].toString()),
    );
  }
}

/// Mirrors `ClassSessionDetailDto` (`GET /class-sessions/:id`).
class ClassSessionDetail extends ClassSession {
  const ClassSessionDetail({
    required super.id,
    required super.groupClass,
    required super.trainer,
    required super.sessionDate,
    required super.startTime,
    required super.endTime,
    required super.capacity,
    required super.bookedCount,
    required super.status,
    super.branch,
    required this.bookings,
  });

  final List<ClassBooking> bookings;

  factory ClassSessionDetail.fromJson(Map<String, dynamic> json) {
    final base = ClassSession.fromJson(json);
    return ClassSessionDetail(
      id: base.id,
      groupClass: base.groupClass,
      trainer: base.trainer,
      branch: base.branch,
      sessionDate: base.sessionDate,
      startTime: base.startTime,
      endTime: base.endTime,
      capacity: base.capacity,
      bookedCount: base.bookedCount,
      status: base.status,
      bookings: (json['bookings'] as List)
          .map((e) => ClassBooking.fromJson(e as Map<String, dynamic>))
          .where((b) => b.status != 'CANCELLED')
          .toList(),
    );
  }
}

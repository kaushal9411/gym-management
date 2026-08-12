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

/// Mirrors `ClassSessionDto` (`GET /class-sessions`).
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
  });

  final String id;
  final ClassSessionSummary groupClass;
  final ClassSessionSummary? trainer;
  final String sessionDate;
  final String startTime;
  final String endTime;
  final int capacity;
  final int bookedCount;
  final String status;

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
        sessionDate: json['sessionDate'] as String,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        capacity: json['capacity'] as int,
        bookedCount: json['bookedCount'] as int,
        status: json['status'] as String,
      );
}

class ClassBooking {
  const ClassBooking({
    required this.id,
    required this.memberId,
    required this.memberName,
    required this.status,
  });

  final String id;
  final String memberId;
  final String memberName;
  final String status;

  factory ClassBooking.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>;
    return ClassBooking(
      id: json['id'] as String,
      memberId: member['id'] as String,
      memberName: member['name'] as String,
      status: json['status'] as String,
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
    required this.bookings,
  });

  final List<ClassBooking> bookings;

  factory ClassSessionDetail.fromJson(Map<String, dynamic> json) {
    final base = ClassSession.fromJson(json);
    return ClassSessionDetail(
      id: base.id,
      groupClass: base.groupClass,
      trainer: base.trainer,
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

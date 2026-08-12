/// Mirrors one item of `GET /portal/bookings` (upcoming only). Used to
/// mark sessions the member has already booked on the Classes screen, so
/// "Book" doesn't get offered on a class they're already in.
class MemberBooking {
  const MemberBooking({
    required this.id,
    required this.status,
    required this.sessionId,
    required this.className,
    required this.branchName,
    required this.sessionDate,
  });

  final String id;
  final String status;
  final String sessionId;
  final String className;
  final String branchName;
  final String sessionDate;

  factory MemberBooking.fromJson(Map<String, dynamic> json) {
    final session = json['session'] as Map<String, dynamic>;
    return MemberBooking(
      id: json['id'] as String,
      status: json['status'] as String,
      sessionId: session['id'] as String,
      className:
          (session['groupClass'] as Map<String, dynamic>)['name'] as String,
      branchName:
          (session['branch'] as Map<String, dynamic>)['name'] as String,
      sessionDate: session['sessionDate'] as String,
    );
  }
}

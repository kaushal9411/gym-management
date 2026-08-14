/// Mirrors `InvitationDto` (`GET/POST /invitations`) — a pending email
/// invite, distinct from `POST /users` direct-create: an invitation waits
/// for the invitee to accept it themselves (web-only accept page), so
/// there's nothing more for the mobile app to do with it than send,
/// resend, or revoke.
class Invitation {
  const Invitation({
    required this.id,
    required this.email,
    required this.roleId,
    required this.roleName,
    required this.invitedByName,
    required this.status,
    required this.expiresAt,
    required this.acceptedAt,
    required this.createdAt,
  });

  final String id;
  final String email;
  final String roleId;
  final String roleName;
  final String invitedByName;
  final String status;
  final DateTime expiresAt;
  final DateTime? acceptedAt;
  final DateTime createdAt;

  bool get isExpired =>
      status == 'PENDING' && DateTime.now().isAfter(expiresAt);

  factory Invitation.fromJson(Map<String, dynamic> json) => Invitation(
        id: json['id'] as String,
        email: json['email'] as String,
        roleId: (json['role'] as Map<String, dynamic>)['id'] as String,
        roleName: (json['role'] as Map<String, dynamic>)['name'] as String,
        invitedByName: json['invitedBy'] as String,
        status: json['status'] as String,
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        acceptedAt: json['acceptedAt'] == null
            ? null
            : DateTime.parse(json['acceptedAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

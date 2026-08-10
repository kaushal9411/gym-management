/// Mirrors `MemberProfileDto` (member plane — `/member/auth/login`).
class MemberProfile {
  const MemberProfile({
    required this.id,
    required this.memberId,
    required this.name,
    required this.email,
    required this.status,
  });

  final String id;
  final String memberId;
  final String name;
  final String? email;
  final String status;

  String get initials {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) {
      return words.first
          .substring(0, words.first.length.clamp(0, 2))
          .toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  factory MemberProfile.fromJson(Map<String, dynamic> json) => MemberProfile(
        id: json['id'] as String,
        memberId: json['memberId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        email: json['email'] as String?,
        status: json['status'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'memberId': memberId,
        'name': name,
        'email': email,
        'status': status,
      };
}

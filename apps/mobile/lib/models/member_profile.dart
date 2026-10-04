/// Mirrors `MemberProfileDto` (member plane — `/member/auth/login`).
class MemberProfile {
  const MemberProfile({
    required this.id,
    required this.memberId,
    required this.name,
    required this.email,
    required this.status,
    this.profilePhotoUrl,
  });

  final String id;
  final String memberId;
  final String name;
  final String? email;
  final String status;

  /// Not returned by login — filled in once the member opens/edits their
  /// profile (`SessionCubit.memberProfileChanged`) and cached with the rest.
  final String? profilePhotoUrl;

  MemberProfile copyWith({
    String? name,
    String? email,
    String? profilePhotoUrl,
    bool clearPhoto = false,
  }) =>
      MemberProfile(
        id: id,
        memberId: memberId,
        name: name ?? this.name,
        email: email ?? this.email,
        status: status,
        profilePhotoUrl:
            clearPhoto ? null : (profilePhotoUrl ?? this.profilePhotoUrl),
      );

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
        profilePhotoUrl: json['profilePhotoUrl'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'memberId': memberId,
        'name': name,
        'email': email,
        'status': status,
        'profilePhotoUrl': profilePhotoUrl,
      };
}

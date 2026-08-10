import 'member_profile.dart';

/// Mirrors `MemberAuthSuccess` — member login has no OTP/2FA challenge
/// state on the backend (`modules/member-auth` — "member plane has zero
/// RBAC"), so unlike staff login this is never a union, always a success
/// or a thrown [ApiException].
class MemberAuthSuccess {
  const MemberAuthSuccess({
    required this.member,
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.refreshToken,
  });

  final MemberProfile member;
  final String accessToken;
  final String accessTokenExpiresAt;
  final String refreshToken;

  factory MemberAuthSuccess.fromJson(Map<String, dynamic> json) =>
      MemberAuthSuccess(
        member: MemberProfile.fromJson(json['member'] as Map<String, dynamic>),
        accessToken: json['accessToken'] as String,
        accessTokenExpiresAt: json['accessTokenExpiresAt'] as String,
        refreshToken: json['refreshToken'] as String,
      );
}

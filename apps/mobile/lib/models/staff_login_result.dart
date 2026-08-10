import 'user_profile.dart';

/// Mirrors `LoginResultDto` — a union of three shapes the same
/// `POST /auth/login` call can return (`auth-response.dto.ts`):
/// straight success, a "check your email for a code" OTP challenge, or a
/// mandatory-2FA-not-yet-set-up challenge.
sealed class StaffLoginResult {
  const StaffLoginResult();

  factory StaffLoginResult.fromJson(Map<String, dynamic> json) {
    final challenge = json['challenge'] as String?;
    return switch (challenge) {
      'otp_required' => StaffOtpRequired(
          email: json['email'] as String,
          purpose: json['purpose'] as String,
          expiresInSeconds: json['expiresInSeconds'] as int,
        ),
      'mfa_setup_required' => StaffMfaSetupRequired(
          email: json['email'] as String,
          setupToken: json['setupToken'] as String,
          expiresInSeconds: json['expiresInSeconds'] as int,
        ),
      _ => StaffLoginSuccess(
          user: UserProfile.fromJson(json['user'] as Map<String, dynamic>),
          accessToken: json['accessToken'] as String,
          accessTokenExpiresAt: json['accessTokenExpiresAt'] as String,
          refreshToken: json['refreshToken'] as String,
        ),
    };
  }
}

class StaffLoginSuccess extends StaffLoginResult {
  const StaffLoginSuccess({
    required this.user,
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.refreshToken,
  });

  final UserProfile user;
  final String accessToken;
  final String accessTokenExpiresAt;
  final String refreshToken;
}

class StaffOtpRequired extends StaffLoginResult {
  const StaffOtpRequired({
    required this.email,
    required this.purpose,
    required this.expiresInSeconds,
  });

  final String email;
  final String purpose; // 'login' | '2fa'
  final int expiresInSeconds;
}

class StaffMfaSetupRequired extends StaffLoginResult {
  const StaffMfaSetupRequired({
    required this.email,
    required this.setupToken,
    required this.expiresInSeconds,
  });

  final String email;
  final String setupToken;
  final int expiresInSeconds;
}

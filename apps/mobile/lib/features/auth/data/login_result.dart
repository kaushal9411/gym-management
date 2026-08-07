import '../../../models/session_user.dart';

/// Mirrors apps/api's LoginResultDto discriminated union exactly
/// (auth-response.dto.ts) — a plain AuthSuccessDto has no `challenge` field,
/// so success is the absence of one, not a fourth variant.
sealed class LoginResult {
  const LoginResult();
}

class LoginSuccess extends LoginResult {
  final SessionUser user;
  final String accessToken;
  final String refreshToken;

  const LoginSuccess({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });
}

class LoginOtpRequired extends LoginResult {
  final String email;
  final String purpose; // 'login' | '2fa'
  final int expiresInSeconds;

  const LoginOtpRequired({
    required this.email,
    required this.purpose,
    required this.expiresInSeconds,
  });
}

class LoginMfaSetupRequired extends LoginResult {
  final String email;
  final String setupToken;

  const LoginMfaSetupRequired({required this.email, required this.setupToken});
}

LoginResult loginResultFromJson(Map<String, dynamic> json) {
  final challenge = json['challenge'] as String?;
  if (challenge == 'otp_required') {
    return LoginOtpRequired(
      email: json['email'] as String,
      purpose: json['purpose'] as String? ?? 'login',
      expiresInSeconds: json['expiresInSeconds'] as int? ?? 600,
    );
  }
  if (challenge == 'mfa_setup_required') {
    return LoginMfaSetupRequired(
      email: json['email'] as String,
      setupToken: json['setupToken'] as String,
    );
  }
  return LoginSuccess(
    user: SessionUser.fromJson(json['user'] as Map<String, dynamic>),
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
  );
}

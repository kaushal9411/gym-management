import 'staff_login_result.dart';

/// Mirrors `TwoFactorSetupDto` — `POST /auth/mfa/setup/begin` response.
class MfaSetupChallenge {
  const MfaSetupChallenge({
    required this.secret,
    required this.otpauthUri,
    required this.qrDataUrl,
  });

  final String secret;
  final String otpauthUri;

  /// A `data:image/png;base64,...` URI — rendered directly via [Image.memory]
  /// after stripping the data-URL prefix.
  final String qrDataUrl;

  factory MfaSetupChallenge.fromJson(Map<String, dynamic> json) =>
      MfaSetupChallenge(
        secret: json['secret'] as String,
        otpauthUri: json['otpauthUri'] as String,
        qrDataUrl: json['qrDataUrl'] as String,
      );
}

/// Mirrors `AuthSuccessDto & TwoFactorConfirmDto` — `POST /auth/mfa/setup/confirm`
/// response: completes login AND hands back one-time backup codes.
class MfaSetupConfirmResult {
  const MfaSetupConfirmResult({required this.login, required this.backupCodes});

  final StaffLoginSuccess login;
  final List<String> backupCodes;

  factory MfaSetupConfirmResult.fromJson(Map<String, dynamic> json) =>
      MfaSetupConfirmResult(
        login: StaffLoginResult.fromJson(json) as StaffLoginSuccess,
        backupCodes: (json['backupCodes'] as List).cast<String>(),
      );
}

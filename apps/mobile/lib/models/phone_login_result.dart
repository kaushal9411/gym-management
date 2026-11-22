import 'member_auth_success.dart';
import 'staff_login_result.dart';

/// What `POST /public/auth/phone-login/verify-otp` resolved to. The person
/// never says whether they are staff or a member — the server works it out
/// and names the plane (`actorType`) that matched, plus the gym (`tenantSlug`).
sealed class PhoneLoginResult {
  const PhoneLoginResult(this.tenantSlug);

  final String tenantSlug;
}

/// A staff account matched — [result] is the normal staff login union
/// (signed in / 2FA challenge / mandatory MFA setup).
final class PhoneLoginStaff extends PhoneLoginResult {
  const PhoneLoginStaff(this.result, super.tenantSlug);

  final StaffLoginResult result;
}

/// A member account matched — that plane has no challenge step.
final class PhoneLoginMember extends PhoneLoginResult {
  const PhoneLoginMember(this.result, super.tenantSlug);

  final MemberAuthSuccess result;
}

import '../../../models/staff_profile.dart';

/// One line of web's profile-completeness checklist.
class CompletenessItem {
  const CompletenessItem(this.label, this.done);

  final String label;
  final bool done;
}

/// Web's `completeness()` (`apps/tenant-web/.../profile/page.tsx`): eight
/// checks over real saved fields — name, phone, photo, the three emergency
/// contact fields, verified e-mail and 2FA.
List<CompletenessItem> profileCompleteness(StaffProfile p) {
  bool has(String? v) => v != null && v.trim().isNotEmpty;
  return [
    CompletenessItem('Full name', p.name.trim().length >= 2),
    CompletenessItem('Phone number', has(p.phone)),
    CompletenessItem('Profile photo', has(p.avatarUrl)),
    CompletenessItem('Emergency contact name', has(p.emergencyContact.name)),
    CompletenessItem('Emergency contact phone', has(p.emergencyContact.phone)),
    CompletenessItem(
      'Emergency contact relation',
      has(p.emergencyContact.relation),
    ),
    CompletenessItem('Verified e-mail', has(p.emailVerifiedAt)),
    CompletenessItem('Two-factor authentication', p.mfaEnabled),
  ];
}

int completenessPercent(List<CompletenessItem> items) => items.isEmpty
    ? 0
    : (items.where((i) => i.done).length / items.length * 100).round();

/// "18 Oct 2026" from an ISO string, or [never] when absent/invalid.
String profileDate(String? iso, {String never = 'Never'}) {
  final d = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
  if (d == null) return never;
  const m = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${d.day} ${m[d.month - 1]} ${d.year}';
}

/// Web's `PREFERENCE_LABELS`.
const kPreferenceLabels = <String, String>{
  'email_billing': 'Billing & subscription emails',
  'email_announcements': 'Platform announcements',
  'inapp_system': 'In-app system alerts',
};

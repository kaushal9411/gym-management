import '../../../models/member_self_profile.dart';

/// One line of web's `completeness()` (`profile-form-lib.ts`): a label and
/// whether the real saved field is filled in.
class ProfileCheck {
  const ProfileCheck(this.label, this.done);

  final String label;
  final bool done;
}

bool _has(String? v) => v != null && v.trim().isNotEmpty;

/// Web's ten checks over real profile fields — photo, phone, e-mail, date of
/// birth, gender, address, emergency contact, fitness goal, height & weight,
/// blood group.
List<ProfileCheck> memberProfileChecks(MemberSelfProfile p) => [
      ProfileCheck('photo', _has(p.profilePhotoUrl)),
      ProfileCheck('phone', _has(p.phone)),
      ProfileCheck('email', _has(p.email)),
      ProfileCheck('date of birth', _has(p.dateOfBirth)),
      ProfileCheck('gender', _has(p.gender)),
      ProfileCheck(
        'address',
        _has(p.address.addressLine) && _has(p.address.city),
      ),
      ProfileCheck(
        'emergency contact',
        _has(p.emergencyContact.name) && _has(p.emergencyContact.phone),
      ),
      ProfileCheck('fitness goal', _has(p.goal)),
      ProfileCheck('height & weight', p.height != null && p.weight != null),
      ProfileCheck('blood group', _has(p.bloodGroup)),
    ];

int memberProfilePercent(List<ProfileCheck> checks) => checks.isEmpty
    ? 0
    : (checks.where((c) => c.done).length / checks.length * 100).round();

/// "Add your phone and email +2 more" (web's wording) or null when complete.
String? memberProfileHint(List<ProfileCheck> checks) {
  final missing = checks.where((c) => !c.done).map((c) => c.label).toList();
  if (missing.isEmpty) return null;
  final head = missing.take(2).join(' and ');
  final more = missing.length > 2 ? ' +${missing.length - 2} more' : '';
  return 'Add your $head$more';
}

import 'payments_analytics.dart' show jsonMap;

/// Mirrors `GET /portal/profile` (member self-service profile). Parsing is
/// defensive and nullable-aware: every optional server field stays nullable
/// (never coerced to ''), numbers may arrive as int/double/numeric string.
///
/// Only [MemberSelfProfile.editable] keys may be sent back through
/// `PATCH /portal/profile`; the [SelfProfileLocked] block is read-only.
class MemberSelfProfile {
  const MemberSelfProfile({
    required this.id,
    required this.memberId,
    required this.firstName,
    required this.lastName,
    required this.name,
    required this.email,
    required this.phone,
    required this.profilePhotoUrl,
    required this.qrCodeImageUrl,
    required this.dateOfBirth,
    required this.gender,
    required this.address,
    required this.emergencyContact,
    required this.occupation,
    required this.height,
    required this.weight,
    required this.bloodGroup,
    required this.maritalStatus,
    required this.anniversary,
    required this.goal,
    required this.bodyType,
    required this.foodPreference,
    required this.fitnessGoals,
    required this.locked,
    required this.editable,
  });

  final String id;
  final String memberId;
  final String firstName;
  final String lastName;
  final String name;
  final String? email;
  final String? phone;
  final String? profilePhotoUrl;
  final String? qrCodeImageUrl;

  /// `YYYY-MM-DD` (kept as the wire string — no timezone shifting).
  final String? dateOfBirth;
  final String? gender;
  final SelfProfileAddress address;
  final SelfProfileEmergency emergencyContact;
  final String? occupation;
  final double? height;
  final double? weight;
  final String? bloodGroup;
  final String? maritalStatus;
  final String? anniversary;
  final String? goal;
  final String? bodyType;
  final String? foodPreference;
  final String? fitnessGoals;
  final SelfProfileLocked locked;
  final List<String> editable;

  /// Same profile with a different photo URL (null clears it).
  MemberSelfProfile copyWithPhoto(String? url) => MemberSelfProfile(
        id: id,
        memberId: memberId,
        firstName: firstName,
        lastName: lastName,
        name: name,
        email: email,
        phone: phone,
        profilePhotoUrl: url,
        qrCodeImageUrl: qrCodeImageUrl,
        dateOfBirth: dateOfBirth,
        gender: gender,
        address: address,
        emergencyContact: emergencyContact,
        occupation: occupation,
        height: height,
        weight: weight,
        bloodGroup: bloodGroup,
        maritalStatus: maritalStatus,
        anniversary: anniversary,
        goal: goal,
        bodyType: bodyType,
        foodPreference: foodPreference,
        fitnessGoals: fitnessGoals,
        locked: locked,
        editable: editable,
      );

  String get initials {
    final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
    final list = words.toList();
    if (list.isEmpty) return '?';
    if (list.length == 1) {
      return list.first
          .substring(0, list.first.length.clamp(0, 2))
          .toUpperCase();
    }
    return (list[0][0] + list[1][0]).toUpperCase();
  }

  /// Form-field text for every editable key, keyed by the PATCH key. ''
  /// means "not set". Numbers drop a trailing `.0`. This is the baseline the
  /// changed-fields diff compares against.
  Map<String, String> toFormValues() => {
        'firstName': firstName,
        'lastName': lastName,
        'email': email ?? '',
        'phone': phone ?? '',
        'dateOfBirth': dateOfBirth ?? '',
        'gender': gender ?? '',
        'maritalStatus': maritalStatus ?? '',
        'anniversary': anniversary ?? '',
        'addressLine': address.addressLine ?? '',
        'city': address.city ?? '',
        'state': address.state ?? '',
        'country': address.country ?? '',
        'postalCode': address.postalCode ?? '',
        'emergencyContactName': emergencyContact.name ?? '',
        'emergencyContactPhone': emergencyContact.phone ?? '',
        'emergencyContactRelation': emergencyContact.relation ?? '',
        'goal': goal ?? '',
        'bodyType': bodyType ?? '',
        'foodPreference': foodPreference ?? '',
        'fitnessGoals': fitnessGoals ?? '',
        'occupation': occupation ?? '',
        'bloodGroup': bloodGroup ?? '',
        'height': formatMeasure(height),
        'weight': formatMeasure(weight),
      };

  factory MemberSelfProfile.fromJson(Map<String, dynamic> json) {
    final first = _str(json['firstName']) ?? '';
    final last = _str(json['lastName']) ?? '';
    return MemberSelfProfile(
      id: _str(json['id']) ?? '',
      memberId: _str(json['memberId']) ?? '',
      firstName: first,
      lastName: last,
      name: _str(json['name']) ?? '$first $last'.trim(),
      email: _str(json['email']),
      phone: _str(json['phone']),
      profilePhotoUrl: _str(json['profilePhotoUrl']),
      qrCodeImageUrl: _str(json['qrCodeImageUrl']),
      dateOfBirth: _str(json['dateOfBirth']),
      gender: _str(json['gender']),
      address: SelfProfileAddress.fromJson(jsonMap(json['address'])),
      emergencyContact:
          SelfProfileEmergency.fromJson(jsonMap(json['emergencyContact'])),
      occupation: _str(json['occupation']),
      height: _num(json['height']),
      weight: _num(json['weight']),
      bloodGroup: _str(json['bloodGroup']),
      maritalStatus: _str(json['maritalStatus']),
      anniversary: _str(json['anniversary']),
      goal: _str(json['goal']),
      bodyType: _str(json['bodyType']),
      foodPreference: _str(json['foodPreference']),
      fitnessGoals: _str(json['fitnessGoals']),
      locked: SelfProfileLocked.fromJson(jsonMap(json['locked'])),
      editable: json['editable'] is List
          ? (json['editable'] as List).whereType<String>().toList()
          : const [],
    );
  }
}

class SelfProfileAddress {
  const SelfProfileAddress({
    this.addressLine,
    this.city,
    this.state,
    this.country,
    this.postalCode,
  });

  final String? addressLine;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;

  factory SelfProfileAddress.fromJson(Map<String, dynamic> j) =>
      SelfProfileAddress(
        addressLine: _str(j['addressLine']),
        city: _str(j['city']),
        state: _str(j['state']),
        country: _str(j['country']),
        postalCode: _str(j['postalCode']),
      );
}

class SelfProfileEmergency {
  const SelfProfileEmergency({this.name, this.phone, this.relation});

  final String? name;
  final String? phone;
  final String? relation;

  factory SelfProfileEmergency.fromJson(Map<String, dynamic> j) =>
      SelfProfileEmergency(
        name: _str(j['name']),
        phone: _str(j['phone']),
        relation: _str(j['relation']),
      );
}

class SelfProfileLocked {
  const SelfProfileLocked({
    this.branchName,
    this.trainerName,
    this.status = '',
    this.joiningDate,
    this.planName,
    this.membershipStatus,
    this.membershipEndDate,
  });

  final String? branchName;
  final String? trainerName;
  final String status;
  final String? joiningDate;
  final String? planName;
  final String? membershipStatus;
  final String? membershipEndDate;

  factory SelfProfileLocked.fromJson(Map<String, dynamic> j) {
    final branch = jsonMap(j['branch']);
    final trainer = jsonMap(j['trainer']);
    final membership = jsonMap(j['membership']);
    return SelfProfileLocked(
      branchName: _str(branch['name']),
      trainerName: _str(trainer['name']),
      status: _str(j['status']) ?? '',
      joiningDate: _str(j['joiningDate']),
      planName: _str(membership['planName']),
      membershipStatus: _str(membership['status']),
      membershipEndDate: _str(membership['endDate']),
    );
  }
}

String? _str(Object? v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

double? _num(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

/// 172.0 -> '172', 72.5 -> '72.5', null -> ''.
String formatMeasure(double? v) {
  if (v == null) return '';
  return v == v.roundToDouble() ? v.round().toString() : v.toString();
}

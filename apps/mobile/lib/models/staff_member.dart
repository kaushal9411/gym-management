enum StaffRole { manager, trainer, receptionist }

extension StaffRoleX on StaffRole {
  String get apiValue => switch (this) {
        StaffRole.manager => 'MANAGER',
        StaffRole.trainer => 'TRAINER',
        StaffRole.receptionist => 'RECEPTIONIST',
      };

  String get label => switch (this) {
        StaffRole.manager => 'Manager',
        StaffRole.trainer => 'Trainer',
        StaffRole.receptionist => 'Receptionist',
      };

  /// Same one-liners as web's `STAFF_ROLE_OPTIONS`.
  String get description => switch (this) {
        StaffRole.manager => 'Runs day-to-day operations for a branch',
        StaffRole.trainer => 'Leads workouts, classes, and member coaching',
        StaffRole.receptionist =>
          'Front-desk check-in, payments, and enquiries',
      };

  static StaffRole fromApi(String v) => switch (v) {
        'MANAGER' => StaffRole.manager,
        'RECEPTIONIST' => StaffRole.receptionist,
        _ => StaffRole.trainer,
      };
}

class StaffBranchSummary {
  const StaffBranchSummary({
    required this.branchId,
    required this.branchName,
    required this.isPrimary,
  });

  final String branchId;
  final String branchName;
  final bool isPrimary;

  factory StaffBranchSummary.fromJson(Map<String, dynamic> json) =>
      StaffBranchSummary(
        branchId: json['branchId']?.toString() ?? '',
        branchName: json['branchName']?.toString() ?? '',
        isPrimary: json['isPrimary'] as bool? ?? false,
      );
}

/// Mirrors `StaffListItemDto`/`StaffDetailDto` (`GET /staff`, `/staff/:id`)
/// as one class — list responses leave the detail-only fields (gender,
/// address, salary, emergency contact, ...) null until fetched via
/// [StaffRepository.getById].
class StaffMember {
  const StaffMember({
    required this.id,
    required this.employeeId,
    required this.name,
    required this.email,
    required this.phone,
    required this.status,
    required this.role,
    required this.primaryBranch,
    required this.joiningDate,
    this.firstName = '',
    this.lastName = '',
    this.avatarUrl,
    this.branches = const [],
    this.lastLoginAt,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.gender,
    this.dateOfBirth,
    this.addressLine,
    this.city,
    this.state,
    this.country,
    this.postalCode,
    this.notes,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.emergencyContactRelation,
    this.employmentType,
    this.salaryType,
    this.salaryAmount,
    this.shift,
    this.weeklyOff,
    this.workStatus,
  });

  final String id;
  final String employeeId;
  final String name;
  final String firstName;
  final String lastName;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final String status;
  final StaffRole role;
  final StaffBranchSummary? primaryBranch;
  final List<StaffBranchSummary> branches;
  final DateTime joiningDate;
  final DateTime? lastLoginAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? deletedAt;
  final String? gender;
  final String? dateOfBirth;
  final String? addressLine;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;
  final String? notes;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? emergencyContactRelation;
  final String? employmentType;
  final String? salaryType;
  final double? salaryAmount;
  final String? shift;
  final String? weeklyOff;
  final String? workStatus;

  bool get isDeleted => deletedAt != null;

  /// Suspended / deactivated / soft-deleted accounts offer "restore" rather
  /// than the suspend/deactivate pair (web `inactive`).
  bool get isInactive =>
      isDeleted || status == 'SUSPENDED' || status == 'DEACTIVATED';

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

  /// The days of `weeklyOff` ("Mon, Tue" or "MONDAY,TUESDAY"), normalised to
  /// three-letter capitalised names.
  List<String> get weeklyOffDays => parseWeeklyOff(weeklyOff);

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    final primary = json['primaryBranch'];
    return StaffMember(
      id: json['id']?.toString() ?? '',
      employeeId: json['employeeId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      status: json['status']?.toString() ?? '',
      role: StaffRoleX.fromApi(json['role']?.toString() ?? ''),
      primaryBranch: primary is Map<String, dynamic>
          ? StaffBranchSummary.fromJson(primary)
          : null,
      branches: (json['branches'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(StaffBranchSummary.fromJson)
          .toList(),
      joiningDate: _date(json['joiningDate']) ?? DateTime.now(),
      lastLoginAt: _date(json['lastLoginAt']),
      createdAt: _date(json['createdAt']),
      updatedAt: _date(json['updatedAt']),
      deletedAt: _date(json['deletedAt']),
      gender: json['gender'] as String?,
      dateOfBirth: json['dateOfBirth'] as String?,
      addressLine: json['addressLine'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      country: json['country'] as String?,
      postalCode: json['postalCode'] as String?,
      notes: json['notes'] as String?,
      emergencyContactName: json['emergencyContactName'] as String?,
      emergencyContactPhone: json['emergencyContactPhone'] as String?,
      emergencyContactRelation: json['emergencyContactRelation'] as String?,
      employmentType: json['employmentType'] as String?,
      salaryType: json['salaryType'] as String?,
      // `salaryAmount` is a Prisma Decimal -> arrives as a STRING.
      salaryAmount: double.tryParse(json['salaryAmount']?.toString() ?? ''),
      shift: json['shift'] as String?,
      weeklyOff: json['weeklyOff'] as String?,
      workStatus: json['workStatus'] as String?,
    );
  }
}

DateTime? _date(Object? v) => v == null ? null : DateTime.tryParse('$v');

const _dayNames = {
  'MON': 'Mon',
  'TUE': 'Tue',
  'WED': 'Wed',
  'THU': 'Thu',
  'FRI': 'Fri',
  'SAT': 'Sat',
  'SUN': 'Sun',
};

/// `weeklyOff` is one free-form string server-side (<= 60 chars). Web writes
/// it as `MONDAY,TUESDAY`; the old mobile screen wrote `Mon, Tue`. Both
/// parse to `['Mon', 'Tue']`.
List<String> parseWeeklyOff(String? raw) {
  if (raw == null || raw.trim().isEmpty) return const [];
  final out = <String>[];
  for (final part in raw.split(',')) {
    final key = part.trim().toUpperCase();
    if (key.length < 3) continue;
    final day = _dayNames[key.substring(0, 3)];
    if (day != null && !out.contains(day)) out.add(day);
  }
  return out;
}

/// Serialises days back into the format web writes (`MONDAY,TUESDAY`), in
/// week order, so the two clients stay interchangeable.
String? encodeWeeklyOff(Iterable<String> days) {
  const order = [
    ('Mon', 'MONDAY'),
    ('Tue', 'TUESDAY'),
    ('Wed', 'WEDNESDAY'),
    ('Thu', 'THURSDAY'),
    ('Fri', 'FRIDAY'),
    ('Sat', 'SATURDAY'),
    ('Sun', 'SUNDAY'),
  ];
  final set = days.toSet();
  final out = [
    for (final d in order)
      if (set.contains(d.$1)) d.$2,
  ];
  return out.isEmpty ? null : out.join(',');
}

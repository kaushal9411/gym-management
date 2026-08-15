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
        branchId: json['branchId'] as String,
        branchName: json['branchName'] as String,
        isPrimary: json['isPrimary'] as bool,
      );
}

/// Mirrors `StaffListItemDto`/`StaffDetailDto` (`GET /staff`, `/staff/:id`)
/// as one class — list responses just leave [joiningDate] as the only
/// employment detail populated; detail-only fields stay null until fetched
/// via [StaffRepository.getById].
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
  final String email;
  final String? phone;
  final String status;
  final StaffRole role;
  final StaffBranchSummary? primaryBranch;
  final DateTime joiningDate;
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

  factory StaffMember.fromJson(Map<String, dynamic> json) => StaffMember(
        id: json['id'] as String,
        employeeId: json['employeeId'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        phone: json['phone'] as String?,
        status: json['status'] as String,
        role: StaffRoleX.fromApi(json['role'] as String),
        primaryBranch: json['primaryBranch'] == null
            ? null
            : StaffBranchSummary.fromJson(
                json['primaryBranch'] as Map<String, dynamic>,
              ),
        joiningDate: DateTime.parse(json['joiningDate'] as String),
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
        salaryAmount: (json['salaryAmount'] as num?)?.toDouble(),
        shift: json['shift'] as String?,
        weeklyOff: json['weeklyOff'] as String?,
        workStatus: json['workStatus'] as String?,
      );
}

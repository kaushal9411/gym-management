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
      );
}

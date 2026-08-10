/// Mirrors `BranchDto` (`apps/api/.../branches/dto/branch.dto.ts`). Only the
/// address sub-fields the mobile screens actually render are kept typed;
/// operating hours/holidays round-trip isn't needed until a screen displays them.
class Branch {
  const Branch({
    required this.id,
    required this.name,
    required this.branchCode,
    required this.email,
    required this.phone,
    required this.addressLine1,
    required this.city,
    required this.capacity,
    required this.isDefault,
    required this.isActive,
    required this.timezone,
    required this.memberCount,
    required this.staffCount,
  });

  final String id;
  final String name;
  final String branchCode;
  final String? email;
  final String? phone;
  final String? addressLine1;
  final String? city;
  final int? capacity;
  final bool isDefault;
  final bool isActive;
  final String timezone;
  final int memberCount;
  final int staffCount;

  factory Branch.fromJson(Map<String, dynamic> json) => Branch(
        id: json['id'] as String,
        name: json['name'] as String,
        branchCode: json['branchCode'] as String? ?? '',
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        addressLine1: json['addressLine1'] as String?,
        city: json['city'] as String?,
        capacity: json['capacity'] as int?,
        isDefault: json['isDefault'] as bool? ?? false,
        isActive: json['isActive'] as bool? ?? true,
        timezone: json['timezone'] as String? ?? 'UTC',
        memberCount: json['memberCount'] as int? ?? 0,
        staffCount: json['staffCount'] as int? ?? 0,
      );
}

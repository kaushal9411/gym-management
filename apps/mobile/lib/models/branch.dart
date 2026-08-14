const branchWeekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/// One weekday's `{open, close, closed}` — same shape at both the tenant
/// and branch level (`operatingHoursDaySchema`).
class DayHours {
  const DayHours({this.open, this.close, this.closed = false});

  final String? open;
  final String? close;
  final bool closed;

  factory DayHours.fromJson(Map<String, dynamic> json) => DayHours(
        open: json['open'] as String?,
        close: json['close'] as String?,
        closed: json['closed'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() =>
      {'open': open, 'close': close, 'closed': closed};
}

/// One `holidays[]` entry — `{date: 'YYYY-MM-DD', label?}`.
class BranchHoliday {
  const BranchHoliday({required this.date, this.label});

  final String date;
  final String? label;

  factory BranchHoliday.fromJson(Map<String, dynamic> json) => BranchHoliday(
        date: json['date'] as String,
        label: json['label'] as String?,
      );

  Map<String, dynamic> toJson() =>
      {'date': date, if (label != null && label!.isNotEmpty) 'label': label};
}

/// Mirrors `BranchDto` (`apps/api/.../branches/dto/branch.dto.ts`).
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
    this.operatingHours = const {},
    this.holidays = const [],
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
  final Map<String, DayHours> operatingHours;
  final List<BranchHoliday> holidays;

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
        operatingHours: (json['operatingHours'] as Map<String, dynamic>?)?.map(
              (k, v) => MapEntry(
                k,
                DayHours.fromJson(v as Map<String, dynamic>),
              ),
            ) ??
            const {},
        holidays: (json['holidays'] as List?)
                ?.map((e) => BranchHoliday.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

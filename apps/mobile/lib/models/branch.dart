const branchWeekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

int? _asInt(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

/// `latitude` / `longitude` are Prisma DECIMALs: they arrive as strings.
double? _asDouble(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

String? _asText(Object? v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

/// One weekday's `{open, close, closed}` — same shape at both the tenant
/// and branch level (`operatingHoursDaySchema`).
class DayHours {
  const DayHours({this.open, this.close, this.closed = false});

  final String? open;
  final String? close;
  final bool closed;

  factory DayHours.fromJson(Map<String, dynamic> json) => DayHours(
        open: _asText(json['open']),
        close: _asText(json['close']),
        closed: json['closed'] == true,
      );

  Map<String, dynamic> toJson() =>
      {'open': open, 'close': close, 'closed': closed};

  /// "06:00 - 22:00", "Closed", or "Not set" when no times were saved.
  String get label {
    if (closed) return 'Closed';
    if (open == null || close == null) return 'Not set';
    return '$open - $close';
  }

  @override
  bool operator ==(Object other) =>
      other is DayHours &&
      other.open == open &&
      other.close == close &&
      other.closed == closed;

  @override
  int get hashCode => Object.hash(open, close, closed);
}

/// One `holidays[]` entry — `{date: 'YYYY-MM-DD', label?}`.
class BranchHoliday {
  const BranchHoliday({required this.date, this.label});

  final String date;
  final String? label;

  factory BranchHoliday.fromJson(Map<String, dynamic> json) => BranchHoliday(
        date: json['date']?.toString() ?? '',
        label: _asText(json['label']),
      );

  Map<String, dynamic> toJson() =>
      {'date': date, if (label != null && label!.isNotEmpty) 'label': label};

  DateTime? get parsed => DateTime.tryParse(date);

  @override
  bool operator ==(Object other) =>
      other is BranchHoliday && other.date == date && other.label == label;

  @override
  int get hashCode => Object.hash(date, label);
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
    this.whatsappNumber,
    this.addressLine2,
    this.state,
    this.country,
    this.postalCode,
    this.latitude,
    this.longitude,
    this.maxMembers,
    this.maxStaff,
    this.allowCheckIn = true,
    this.notes,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
  });

  final String id;
  final String name;
  final String branchCode;
  final String? email;
  final String? phone;
  final String? whatsappNumber;
  final String? addressLine1;
  final String? addressLine2;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;
  final double? latitude;
  final double? longitude;
  final int? capacity;
  final int? maxMembers;
  final int? maxStaff;
  final bool allowCheckIn;
  final String? notes;
  final bool isDefault;
  final bool isActive;
  final String timezone;
  final int memberCount;
  final int staffCount;
  final Map<String, DayHours> operatingHours;
  final List<BranchHoliday> holidays;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? deletedAt;

  bool get isDeleted => deletedAt != null;

  /// `City, State` (whichever exist).
  String get location =>
      [city, state].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  /// Street + area + postcode on as few lines as it takes.
  String get fullAddress => [
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
      ].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  bool get hasCoordinates => latitude != null && longitude != null;

  /// Members / capacity, 0..1 — null when no capacity is set.
  double? get capacityUsage => capacity != null && capacity! > 0
      ? (memberCount / capacity!).clamp(0.0, 1.0)
      : null;

  factory Branch.fromJson(Map<String, dynamic> json) => Branch(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        branchCode: json['branchCode'] as String? ?? '',
        email: _asText(json['email']),
        phone: _asText(json['phone']),
        whatsappNumber: _asText(json['whatsappNumber']),
        addressLine1: _asText(json['addressLine1']),
        addressLine2: _asText(json['addressLine2']),
        city: _asText(json['city']),
        state: _asText(json['state']),
        country: _asText(json['country']),
        postalCode: _asText(json['postalCode']),
        latitude: _asDouble(json['latitude']),
        longitude: _asDouble(json['longitude']),
        capacity: _asInt(json['capacity']),
        maxMembers: _asInt(json['maxMembers']),
        maxStaff: _asInt(json['maxStaff']),
        allowCheckIn: json['allowCheckIn'] as bool? ?? true,
        notes: _asText(json['notes']),
        isDefault: json['isDefault'] as bool? ?? false,
        isActive: json['isActive'] as bool? ?? true,
        timezone: json['timezone'] as String? ?? 'UTC',
        memberCount: _asInt(json['memberCount']) ?? 0,
        staffCount: _asInt(json['staffCount']) ?? 0,
        operatingHours: {
          if (json['operatingHours'] is Map)
            for (final e in (json['operatingHours'] as Map).entries)
              if (e.value is Map)
                e.key.toString(): DayHours.fromJson(
                  Map<String, dynamic>.from(e.value as Map),
                ),
        },
        holidays: [
          if (json['holidays'] is List)
            for (final h in json['holidays'] as List)
              if (h is Map)
                BranchHoliday.fromJson(Map<String, dynamic>.from(h)),
        ],
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
        updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
        deletedAt: DateTime.tryParse(json['deletedAt']?.toString() ?? ''),
      );
}

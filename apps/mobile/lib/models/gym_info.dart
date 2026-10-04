import 'payments_analytics.dart' show jsonList, jsonMap;

String? _s(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;

class GymHour {
  const GymHour({
    required this.day,
    required this.open,
    required this.close,
    required this.closed,
  });

  /// Lower-case weekday name as the API sends it ("monday").
  final String day;
  final String? open;
  final String? close;
  final bool closed;

  factory GymHour.fromJson(Map<String, dynamic> j) => GymHour(
        day: _s(j['day']) ?? '',
        open: _s(j['open']),
        close: _s(j['close']),
        closed: j['closed'] == true,
      );
}

List<GymHour>? _hours(Object? v) {
  final rows = jsonList(v).map(GymHour.fromJson).toList();
  return rows.isEmpty ? null : rows;
}

/// Flat address; [oneLine] skips blank parts.
class GymAddress {
  const GymAddress({
    this.line1,
    this.line2,
    this.city,
    this.state,
    this.country,
    this.postalCode,
  });

  final String? line1;
  final String? line2;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;

  String get oneLine => [line1, line2, city, state, postalCode, country]
      .whereType<String>()
      .join(', ');

  static GymAddress? parse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    final a = GymAddress(
      line1: _s(v['line1']),
      line2: _s(v['line2']),
      city: _s(v['city']),
      state: _s(v['state']),
      country: _s(v['country']),
      postalCode: _s(v['postalCode']),
    );
    return a.oneLine.isEmpty ? null : a;
  }
}

class GymBranchInfo {
  const GymBranchInfo({
    required this.name,
    required this.phone,
    required this.email,
    required this.address,
    required this.businessHours,
  });

  final String name;
  final String? phone;
  final String? email;
  final GymAddress? address;
  final List<GymHour>? businessHours;
}

/// Mirrors `MemberGymDto` (`GET /portal/gym`). Every contact field is
/// nullable — a gym that hasn't filled settings in returns all-null, and the
/// screen shows only what exists.
class GymInfo {
  const GymInfo({
    required this.name,
    required this.logoUrl,
    required this.address,
    required this.phone,
    required this.email,
    required this.website,
    required this.businessHours,
    required this.social,
    required this.branch,
  });

  final String name;
  final String? logoUrl;
  final GymAddress? address;
  final String? phone;
  final String? email;
  final String? website;
  final List<GymHour>? businessHours;
  final Map<String, String> social;
  final GymBranchInfo? branch;

  factory GymInfo.fromJson(Map<String, dynamic> j) {
    final b = j['branch'];
    final bm = jsonMap(b);
    return GymInfo(
      name: _s(j['name']) ?? 'Your gym',
      logoUrl: _s(j['logoUrl']),
      address: GymAddress.parse(j['address']),
      phone: _s(j['phone']),
      email: _s(j['email']),
      website: _s(j['website']),
      businessHours: _hours(j['businessHours']),
      social: {
        for (final e in jsonMap(j['social']).entries)
          if (_s(e.value) != null) e.key: _s(e.value)!,
      },
      branch: b is Map<String, dynamic>
          ? GymBranchInfo(
              name: _s(bm['name']) ?? '',
              phone: _s(bm['phone']),
              email: _s(bm['email']),
              address: GymAddress.parse(bm['address']),
              businessHours: _hours(bm['businessHours']),
            )
          : null,
    );
  }
}

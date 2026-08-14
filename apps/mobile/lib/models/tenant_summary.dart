/// One row of `GET /public/tenants` — the pre-login "pick your gym" list.
/// Deliberately minimal (name/slug/logo only); full branding is only
/// fetched for the one gym the user actually selects, via
/// `PublicTenantRepository.resolve`.
class TenantSummary {
  const TenantSummary({required this.slug, required this.name, this.logoUrl});

  final String slug;
  final String name;
  final String? logoUrl;

  /// Same "first two letters of the first two words" rule every other
  /// gym-identity model in this app (`TenantBranding`, `RecentGym`) uses.
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

  factory TenantSummary.fromJson(Map<String, dynamic> json) => TenantSummary(
        slug: json['slug'] as String,
        name: json['name'] as String,
        logoUrl: json['logoUrl'] as String?,
      );
}
